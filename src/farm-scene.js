/* Procedural farm illustration. All pond values are supplied by the caller. */
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const mix = (a, b, amount) => {
  const t = clamp(amount, 0, 1);
  const parts = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const aa = parts(a), bb = parts(b);
  return `rgb(${aa.map((v, i) => Math.round(v + (bb[i] - v) * t)).join(',')})`;
};
const LAYOUT = [
  { id: 'P01', x: -4.45, z: -3.15, width: 7.4, depth: 4.7 },
  { id: 'P02', x: 4.45, z: -3.15, width: 7.4, depth: 4.7 },
  { id: 'P03', x: -4.45, z: 3.15, width: 7.4, depth: 4.7 },
  { id: 'P04', x: 4.45, z: 3.15, width: 7.4, depth: 4.7 }
];
const riskColor = risk => {
  const name = String(risk ?? '').toLowerCase();
  if (/critical|danger|high|red|วิกฤต|สูง/.test(name)) return '#d97355';
  if (/watch|warn|caution|moderate|medium|amber|yellow|เฝ้า|กลาง/.test(name)) return '#d6a548';
  if (/normal|low|safe|green|ปกติ|ต่ำ/.test(name)) return '#329d89';
  return '#8fa3a3';
};

export class FarmScene {
  constructor(canvas, { onSelectPond } = {}) {
    if (!canvas || !canvas.getContext) throw new TypeError('FarmScene requires a canvas element.');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D is unavailable.');
    this.onSelectPond = typeof onSelectPond === 'function' ? onSelectPond : () => {};
    this.state = { ponds: LAYOUT.map(p => ({ id: p.id })), selectedId: 'P01', metricsByPond: {}, layer: 'oxygen', activeAerators: {} };
    this.yaw = Math.PI / 4;
    this.pitch = .49;
    this.zoomLevel = 1;
    this.width = 0;
    this.height = 0;
    this.hitAreas = [];
    this.visible = true;
    this.destroyed = false;
    this.frame = 0;
    this.phase = 0;
    this.lastPaint = 0;
    this.pointer = null;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.handlers = {
      down: event => this._pointerDown(event),
      move: event => this._pointerMove(event),
      up: event => this._pointerUp(event),
      cancel: () => { this.pointer = null; this.canvas.style.cursor = 'grab'; },
      wheel: event => { event.preventDefault(); this.zoom(-event.deltaY * .001); },
      motion: () => this._schedule(),
      visibility: () => this._schedule()
    };
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'แบบจำลองฟาร์มกุ้งสี่บ่อ ลากเพื่อหมุน เลื่อนล้อเมาส์เพื่อซูม หรือเลือกบ่อจากปุ่มด้านล่าง');
    canvas.addEventListener('pointerdown', this.handlers.down);
    canvas.addEventListener('pointermove', this.handlers.move);
    canvas.addEventListener('pointerup', this.handlers.up);
    canvas.addEventListener('pointercancel', this.handlers.cancel);
    canvas.addEventListener('wheel', this.handlers.wheel, { passive: false });
    this.reducedMotion?.addEventListener?.('change', this.handlers.motion);
    document.addEventListener('visibilitychange', this.handlers.visibility);
    this.resizeObserver = new ResizeObserver(() => this._resize());
    this.resizeObserver.observe(canvas);
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver(entries => {
        this.visible = entries[0]?.isIntersecting !== false;
        this._schedule();
      });
      this.intersectionObserver.observe(canvas);
    }
    this._resize();
  }

  update(next = {}) {
    if (this.destroyed) return;
    this.state = { ...this.state, ...next };
    if (!['oxygen', 'salinity', 'temperature'].includes(this.state.layer)) this.state.layer = 'oxygen';
    this.draw();
    this._schedule();
  }

  setLayer(layer) {
    if (['oxygen', 'salinity', 'temperature'].includes(layer)) this.update({ layer });
  }

  rotate(delta) {
    if (!finite(delta)) return;
    this.yaw += delta;
    this.draw();
  }

  zoom(delta) {
    if (!finite(delta)) return;
    this.zoomLevel = clamp(this.zoomLevel * Math.exp(delta), .72, 1.65);
    this.draw();
  }

  resetView() {
    this.yaw = Math.PI / 4;
    this.pitch = .49;
    this.zoomLevel = 1;
    this.draw();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.reducedMotion?.removeEventListener?.('change', this.handlers.motion);
    document.removeEventListener('visibilitychange', this.handlers.visibility);
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.handlers.down);
    c.removeEventListener('pointermove', this.handlers.move);
    c.removeEventListener('pointerup', this.handlers.up);
    c.removeEventListener('pointercancel', this.handlers.cancel);
    c.removeEventListener('wheel', this.handlers.wheel);
  }

  _resize() {
    if (this.destroyed) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, bounds.width || this.canvas.clientWidth || 640);
    this.height = Math.max(1, bounds.height || this.canvas.clientHeight || 420);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.draw();
    this._schedule();
  }

  _schedule() {
    cancelAnimationFrame(this.frame);
    if (this.destroyed) return;
    this.draw();
    if (!this.visible || document.hidden || this.reducedMotion?.matches) return;
    const tick = now => {
      if (this.destroyed || !this.visible || document.hidden || this.reducedMotion?.matches) return;
      if (now - this.lastPaint > 1000 / 24) {
        this.phase = now * .0012;
        this.lastPaint = now;
        this.draw();
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  _pointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, dragged: false };
    this.canvas.setPointerCapture?.(event.pointerId);
    this.canvas.style.cursor = 'grabbing';
  }

  _pointerMove(event) {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    const p = this.pointer;
    const dx = event.clientX - p.x, dy = event.clientY - p.y;
    if (Math.hypot(event.clientX - p.startX, event.clientY - p.startY) > 5) p.dragged = true;
    if (p.dragged) {
      this.yaw += dx * .006;
      this.pitch = clamp(this.pitch + dy * .003, .29, .82);
      this.draw();
    }
    p.x = event.clientX;
    p.y = event.clientY;
  }

  _pointerUp(event) {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    const p = this.pointer;
    this.pointer = null;
    this.canvas.style.cursor = 'grab';
    if (!p.dragged) {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      const hit = [...this.hitAreas].reverse().find(area => {
        if (area.label && x >= area.label.x && x <= area.label.x + area.label.w && y >= area.label.y && y <= area.label.y + area.label.h) return true;
        let inside = false;
        for (let i = 0, j = area.points.length - 1; i < area.points.length; j = i++) {
          const a = area.points[i], b = area.points[j];
          if (((a.y > y) !== (b.y > y)) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
      });
      if (hit) {
        this.state.selectedId = hit.id;
        this.draw();
        this.onSelectPond(hit.id);
      }
    }
  }

  _project(x, y, z) {
    const cosine = Math.cos(this.yaw), sine = Math.sin(this.yaw);
    const horizontal = x * cosine - z * sine;
    const depth = x * sine + z * cosine;
    return {
      x: this.width * .5 + horizontal * this.scale,
      y: this.height * .53 + (depth * Math.sin(this.pitch) - y * Math.cos(this.pitch)) * this.scale,
      depth: depth * Math.cos(this.pitch) + y * Math.sin(this.pitch)
    };
  }

  _polygon(world, fill, stroke, extra) {
    const points = world.map(p => this._project(...p));
    this.queue.push({ depth: points.reduce((sum, p) => sum + p.depth, 0) / points.length, points, fill, stroke, extra });
    return points;
  }

  _flat(x, z, width, depth, y, fill, stroke, extra) {
    return this._polygon([[x-width/2,y,z-depth/2],[x+width/2,y,z-depth/2],[x+width/2,y,z+depth/2],[x-width/2,y,z+depth/2]],fill,stroke,extra);
  }

  _box(x, z, width, depth, bottom, height, top, side = '#bccdb8', front = '#d0ddc9') {
    const l=x-width/2, r=x+width/2, back=z-depth/2, near=z+depth/2, y=bottom+height;
    if (Math.sin(this.yaw)>0) this._polygon([[r,bottom,back],[r,bottom,near],[r,y,near],[r,y,back]],side);
    else this._polygon([[l,bottom,near],[l,bottom,back],[l,y,back],[l,y,near]],side);
    if (Math.cos(this.yaw)>0) this._polygon([[l,bottom,near],[r,bottom,near],[r,y,near],[l,y,near]],front);
    else this._polygon([[r,bottom,back],[l,bottom,back],[l,y,back],[r,y,back]],front);
    this._flat(x,z,width,depth,y,top);
  }

  _tree(x, z, size = 1) {
    this._box(x,z,.17,.17,-.1,1.25*size,'#a38c66','#8a7657','#aa9168');
    const p = this._project(x,1.5*size,z);
    this.queue.push({ depth:p.depth, draw:ctx=>{
      const r=.53*this.scale*size;
      ctx.fillStyle='rgba(37,93,65,.10)';
      const shadow=this._project(x+.25,-.08,z+.3);
      ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,r*1.2,r*.45,0,0,TAU);ctx.fill();
      const gradient=ctx.createLinearGradient(p.x-r,p.y-r,p.x+r,p.y+r);
      gradient.addColorStop(0,'#9dca8d');gradient.addColorStop(.5,'#77b17e');gradient.addColorStop(1,'#519873');
      ctx.fillStyle=gradient;
      for(const [dx,dy,radius] of [[-.32,0,.77],[.34,-.07,.79],[0,-.48,.78]]) {
        ctx.beginPath();ctx.arc(p.x+r*dx,p.y+r*dy,r*radius,0,TAU);ctx.fill();
      }
    }});
  }

  _aeratorCount(id) {
    const source = this.state.activeAerators;
    if (finite(source)) return clamp(Math.round(source),0,8);
    const count = source?.[id];
    if (Array.isArray(count)) return count.filter(Boolean).length;
    if (finite(count)) return clamp(Math.round(count),0,8);
    if (Array.isArray(source)) return source.filter(item => String(item?.pondId ?? item).startsWith(id) && item?.active !== false).length;
    return 0;
  }

  _aerator(x,z,active,index) {
    const bright=active?'#eef9f4':'#d0ddda';
    this._box(x,z-.19,1.02,.13,.39,.12,bright,'#b2cfca','#c8e3db');
    this._box(x,z+.19,1.02,.13,.39,.12,bright,'#b2cfca','#c8e3db');
    this._box(x,z,.28,.3,.51,.22,active?'#5c8880':'#99aaa5','#54736c','#7f9e94');
    const angle=active?this.phase*3+index:Math.PI/4;
    for (const offset of [-.33,.33]) {
      for(let blade=0;blade<4;blade++) {
        const a=angle+blade*Math.PI/2;
        const yy=.58+Math.sin(a)*.23, zz=z+Math.cos(a)*.23;
        this._polygon([[x+offset-.06,yy-.055,zz],[x+offset+.06,yy-.055,zz],[x+offset+.06,yy+.055,zz],[x+offset-.06,yy+.055,zz]],active?'#e8f7f0':'#b7c9c2');
      }
    }
    if(active) {
      const center=this._project(x,.405,z);
      this.queue.push({depth:center.depth+.03,draw:ctx=>{
        ctx.save();ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=1;
        for(let i=0;i<5;i++) {
          const progress=((this.phase*.5+i*.19)%1);
          const ring=.35+progress*.55;
          const points=[];
          for(let a=0;a<=12;a++) {const theta=a/12*TAU;points.push(this._project(x+Math.cos(theta)*ring,.42,z+Math.sin(theta)*ring*.7));}
          ctx.globalAlpha=(1-progress)*.65;ctx.beginPath();points.forEach((p,j)=>j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
        }
        ctx.restore();
      }});
    }
  }

  _pond(geometry, supplied, index) {
    const {x,z,width,depth}=geometry;
    const id=supplied?.id ?? geometry.id;
    const metrics=this.state.metricsByPond?.[id] ?? {};
    const key=this.state.layer==='oxygen'?'do':this.state.layer;
    const value=metrics[key];
    let water='#a7b8b3';
    if(finite(value)) {
      if(key==='do') water=mix('#2c7e89','#88cfba',(value-2)/7);
      if(key==='salinity') water=mix('#8fcfc0','#3e8ea9',value/40);
      if(key==='temperature') water=mix('#6bbfbb','#d5bd85',(value-23)/13);
    }
    const selected=id===this.state.selectedId;
    this._box(x,z,width+.43,depth+.43,-.12,.5,'#d0ddbb','#a2b69a','#b5c8a8');
    this._box(x,z,width+.15,depth+.15,.37,.2,'#edf0d8','#bfcdb5','#d3ddc4');
    const points=this._flat(x,z,width-.16,depth-.16,.59,water,undefined,{water:true,selected});
    // The shallow inside walls provide a visible water-depth edge.
    this._polygon([[x-width/2+.08,.59,z-depth/2+.08],[x+width/2-.08,.59,z-depth/2+.08],[x+width/2-.08,.69,z-depth/2+.08],[x-width/2+.08,.69,z-depth/2+.08]],'#6b9384');
    this._polygon([[x-width/2+.08,.59,z-depth/2+.08],[x-width/2+.08,.59,z+depth/2-.08],[x-width/2+.08,.69,z+depth/2-.08],[x-width/2+.08,.69,z-depth/2+.08]],'#86a795');
    const active=this._aeratorCount(id);
    const capacity=finite(supplied?.totalAerators)?clamp(Math.round(supplied.totalAerators),0,8):2;
    const machines=[[-width*.33,-depth*.28],[width*.33,depth*.28],[-width*.33,depth*.28],[width*.33,-depth*.28],[-width*.11,-depth*.28],[width*.11,depth*.28],[-width*.11,depth*.28],[width*.11,-depth*.28]];
    machines.slice(0,Math.max(capacity,active)).forEach(([dx,dz],i)=>this._aerator(x+dx,z+dz,i<active,index*9+i));
    const sensorX=x+width*.26, sensorZ=z-depth*.27;
    this._box(sensorX,sensorZ,.17,.17,.61,.55,'#f3ae5e','#d58b44','#efb46b');
    this._box(sensorX,sensorZ,.38,.28,.6,.09,'#f5faf5','#becfc8','#e2ece6');
    const center=this._project(x,.69,z);
    this.labels.push({id,metrics,value,key,selected,center,points,depth:center.depth});
  }

  draw() {
    if(this.destroyed || !this.width || !this.height) return;
    const ctx=this.ctx;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    ctx.clearRect(0,0,this.width,this.height);
    this.scale=Math.min(this.width/30.2,this.height/20.4)*this.zoomLevel;
    this.queue=[];this.labels=[];
    this._box(0,0,22.2,17.2,-.52,.38,'#dce9cf','#bfd2b6','#ccddbf');
    this._flat(0,0,21.5,1.15,-.12,'#f3efdf');
    this._flat(0,0,1.15,16.6,-.11,'#f3efdf');
    this._flat(0,-6.1,21.5,.75,-.1,'#eee9d8');
    this._flat(0,6.1,21.5,.6,-.1,'#eee9d8');
    for(let x=-9.7;x<=9.7;x+=1.75) this._flat(x,0,.52,.035,-.09,'#d7d3c5');
    // Ground planes span the entire site, so paint them before depth-sorted assets.
    const groundQueue=this.queue.splice(0);
    // Service shed, door, and roof.
    this._box(-4.3,-7.25,3.2,1.55,-.1,1.18,'#edf0df','#cbd7cf','#dde4d7');
    this._box(-4.3,-7.25,3.55,1.86,1.08,.12,'#7a9b91','#5a7d73','#74968a');
    this._box(-4.3,-6.44,.58,.025,-.09,.82,'#426b63','#426b63','#426b63');
    this._box(-3.35,-6.43,.5,.025,.37,.37,'#a7d3ce','#89b9b1','#a7d3ce');
    // Solar panels on a low frame.
    this._box(3.65,-7.3,3.15,1.48,.2,.08,'#335d70','#244c5d','#3d6476');
    this._flat(3.65,-7.3,3.15,1.48,.3,'#397087',undefined,{solar:true});
    this._box(2.5,-7.3,.13,1.2,-.12,.34,'#aebfb7','#a0b2a9','#c0cfc7');
    this._box(4.8,-7.3,.13,1.2,-.12,.34,'#aebfb7','#a0b2a9','#c0cfc7');
    for(const side of [-1,1])for(let i=0;i<5;i++)this._tree(side*10.25,-6.2+i*3.1,.72+(i%2)*.15);
    for(const x of [-8.4,-6.5,6.6,8.6])this._tree(x,7.65,.75+(x>0?.12:0));
    const supplied=Array.isArray(this.state.ponds)?this.state.ponds:[];
    LAYOUT.forEach((geometry,index)=>this._pond(geometry,supplied.find(p=>p?.id===geometry.id)??supplied[index],index));
    this.queue.sort((a,b)=>a.depth-b.depth);
    this.queue=groundQueue.concat(this.queue);
    for(const item of this.queue) {
      if(item.draw){item.draw(ctx);continue;}
      const p=item.points;
      ctx.beginPath();p.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.closePath();
      ctx.fillStyle=item.fill;ctx.fill();
      if(item.extra?.solar) {
        ctx.save();ctx.clip();ctx.strokeStyle='#6a9aab';ctx.lineWidth=.7;
        for(let col=1;col<6;col++) {
          const t=col/6;
          ctx.beginPath();ctx.moveTo(p[0].x+(p[1].x-p[0].x)*t,p[0].y+(p[1].y-p[0].y)*t);ctx.lineTo(p[3].x+(p[2].x-p[3].x)*t,p[3].y+(p[2].y-p[3].y)*t);ctx.stroke();
        }
        for(let row=1;row<3;row++) {
          const t=row/3;
          ctx.beginPath();ctx.moveTo(p[0].x+(p[3].x-p[0].x)*t,p[0].y+(p[3].y-p[0].y)*t);ctx.lineTo(p[1].x+(p[2].x-p[1].x)*t,p[1].y+(p[2].y-p[1].y)*t);ctx.stroke();
        }
        ctx.restore();
      }
      if(item.extra?.water) {
        ctx.save();ctx.clip();
        const xs=p.map(v=>v.x),ys=p.map(v=>v.y);
        const gradient=ctx.createLinearGradient(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys));
        gradient.addColorStop(0,'rgba(255,255,255,.20)');gradient.addColorStop(.6,'rgba(255,255,255,0)');gradient.addColorStop(1,'rgba(5,76,82,.09)');
        ctx.fillStyle=gradient;ctx.fillRect(Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
        ctx.strokeStyle='rgba(255,255,255,.10)';ctx.lineWidth=.8;
        for(let row=0;row<9;row++) {
          const yy=Math.min(...ys)+(row+.5)*(Math.max(...ys)-Math.min(...ys))/9;
          ctx.beginPath();ctx.moveTo(Math.min(...xs),yy);ctx.bezierCurveTo(this.width*.43,yy+2,this.width*.57,yy-2,Math.max(...xs),yy+1);ctx.stroke();
        }
        ctx.restore();
      }
      if(item.stroke){ctx.strokeStyle=item.stroke;ctx.lineWidth=1;ctx.stroke();}
    }
    this.hitAreas=[];
    this.labels.sort((a,b)=>a.depth-b.depth);
    for(const pond of this.labels) {
      if(pond.selected) {
        ctx.save();ctx.beginPath();pond.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
        ctx.strokeStyle='#19b7ab';ctx.lineWidth=2;ctx.shadowColor='rgba(25,183,171,.24)';ctx.shadowBlur=7;ctx.stroke();ctx.restore();
      }
      const compact=this.width<520;
      const unit=pond.key==='do'?'mg/L':pond.key==='salinity'?'ppt':'°C';
      const reading=finite(pond.value)?`${pond.value.toFixed(1)}${compact?'':` ${unit}`}`:'—';
      const w=compact?64:103,h=compact?39:43;
      const x=pond.center.x-w/2,y=pond.center.y-h/2;
      ctx.save();ctx.shadowColor='rgba(31,70,61,.10)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
      ctx.fillStyle=pond.selected?'rgba(255,255,255,.97)':'rgba(255,255,255,.89)';
      ctx.beginPath();ctx.roundRect(x,y,w,h,8);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
      if(pond.selected){ctx.strokeStyle='rgba(25,183,171,.65)';ctx.lineWidth=1;ctx.stroke();}
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 11px system-ui, sans-serif';ctx.fillStyle='#718782';ctx.fillText(pond.id,pond.center.x,y+11);
      ctx.font=`600 ${compact?12:13}px system-ui, sans-serif`;ctx.fillStyle='#254a46';ctx.fillText(reading,pond.center.x,y+(compact?27:29));
      ctx.fillStyle=riskColor(pond.metrics.riskLevel);ctx.beginPath();ctx.arc(x+w-9,y+10,2.6,0,TAU);ctx.fill();ctx.restore();
      this.hitAreas.push({id:pond.id,points:pond.points,label:{x,y,w,h}});
    }
  }
}
