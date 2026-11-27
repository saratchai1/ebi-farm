/* Responsive chart: draws supplied observations/predictions only. */
let chartSequence = 0;
const NS = 'http://www.w3.org/2000/svg';
const isNumber = value => typeof value === 'number' && Number.isFinite(value);
const bound = (value, min, max) => Math.max(min, Math.min(max, value));
const svgNode = (tag, attrs = {}, text) => {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (text !== undefined) node.textContent = text;
  return node;
};
const normalize = list => (Array.isArray(list) ? list : []).filter(point => point && typeof point === 'object').map(point => {
  const minutes = Array.isArray(point) ? point[0] : point.minutes ?? point.minute ?? point.t ?? point.offsetMinutes;
  const value = Array.isArray(point) ? point[1] : point.do ?? point.value ?? point.mean ?? point.predicted;
  const low = Array.isArray(point) ? point[2] : point.low ?? point.lower;
  const high = Array.isArray(point) ? point[3] : point.high ?? point.upper;
  return { minutes, value: isNumber(value) ? value : null, low: isNumber(low) ? low : null, high: isNumber(high) ? high : null };
}).filter(point => isNumber(point.minutes)).sort((a,b) => a.minutes-b.minutes);

export class ForecastChart {
  constructor(container) {
    if (!container?.appendChild) throw new TypeError('ForecastChart requires a container element.');
    this.container = container;
    this.id = `shrimp-forecast-${++chartSequence}`;
    this.data = { history: [], baseline: [], proposed: [], threshold: 5, clockHour: 16, quality: 'ok' };
    this.width = 0;
    this.destroyed = false;
    this.root = document.createElement('div');
    this.root.className = 'forecast-chart';
    Object.assign(this.root.style, { position: 'relative', width: '100%', minWidth: '0' });
    this.svg = svgNode('svg', { role: 'img', tabindex: '0', 'aria-label': 'กราฟออกซิเจนละลายน้ำ ใช้ปุ่มลูกศรซ้ายขวาเพื่ออ่านค่าแต่ละช่วงเวลา' });
    Object.assign(this.svg.style, { display: 'block', width: '100%', height: '260px', overflow: 'visible' });
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'forecast-tooltip';
    Object.assign(this.tooltip.style, { display: 'none', position: 'absolute', pointerEvents: 'none', background: '#fff', color: '#24463f', border: '1px solid #dbe7e2', borderRadius: '9px', padding: '9px 11px', fontSize: '12px', lineHeight: '1.65', boxShadow: '0 6px 20px rgba(28,66,57,.09)', maxWidth: '220px', zIndex: '2' });
    this.announcement = document.createElement('div');
    this.announcement.setAttribute('aria-live', 'polite');
    Object.assign(this.announcement.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' });
    this.root.append(this.svg, this.tooltip, this.announcement);
    container.replaceChildren(this.root);
    this.handlers = {
      move: event => this._pointer(event),
      leave: () => this._hide(),
      down: event => { this._pointer(event); },
      key: event => this._key(event),
      focus: () => this._show(0, true),
      blur: () => this._hide()
    };
    this.svg.addEventListener('pointermove', this.handlers.move);
    this.svg.addEventListener('pointerleave', this.handlers.leave);
    this.svg.addEventListener('pointerdown', this.handlers.down);
    this.svg.addEventListener('keydown', this.handlers.key);
    this.svg.addEventListener('focus', this.handlers.focus);
    this.svg.addEventListener('blur', this.handlers.blur);
    this.resizeObserver = new ResizeObserver(() => this._draw());
    this.resizeObserver.observe(container);
    this._draw();
  }

  update(next = {}) {
    if (this.destroyed) return;
    this.data = { ...this.data, ...next };
    this._draw();
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver.disconnect();
    Object.entries({ pointermove:'move', pointerleave:'leave', pointerdown:'down', keydown:'key', focus:'focus', blur:'blur' }).forEach(([event, handler])=>this.svg.removeEventListener(event,this.handlers[handler]));
    this.root.remove();
  }

  _time(minutes) {
    const total = Math.round((isNumber(this.data.clockHour) ? this.data.clockHour : 16) * 60 + minutes);
    const normalized = ((total % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2,'0')}:${String(normalized % 60).padStart(2,'0')}`;
  }

  _draw() {
    if (this.destroyed) return;
    const width = Math.max(240, Math.round(this.container.getBoundingClientRect().width || this.container.clientWidth || 640));
    this.width = width;
    const height = 260;
    const margin = { left: 44, right: 16, top: 29, bottom: 40 };
    this.plot = { left:margin.left, right:width-margin.right, top:margin.top, bottom:height-margin.bottom };
    this.svg.replaceChildren();
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.appendChild(svgNode('title', {}, 'แนวโน้มออกซิเจนละลายน้ำและผลคาดการณ์ตามข้อมูลที่ป้อน'));
    this.svg.appendChild(svgNode('desc', {}, 'เส้นประวัติสิ้นสุดที่เวลาปัจจุบัน เส้นคาดการณ์เริ่มที่เวลาปัจจุบัน แถบสีแสดงช่วงความไม่แน่นอนเมื่อมีข้อมูล'));
    this.tooltip.style.display = 'none';
    this.series = [
      { key:'history', label:'ประวัติ', color:'#264b47', points:normalize(this.data.history).filter(p=>p.minutes<=0) },
      { key:'baseline', label:'แผนเดิม', color:'#c58b3d', points:normalize(this.data.baseline).filter(p=>p.minutes>=0) },
      { key:'proposed', label:'แผนที่ปรับ', color:'#159f92', points:normalize(this.data.proposed).filter(p=>p.minutes>=0) }
    ];
    const all = this.series.flatMap(s=>s.points);
    const values = all.flatMap(p=>[p.value,p.low,p.high]).filter(isNumber);
    if(this.data.quality==='missing' || !values.length) {
      this.canRead=false;
      this.svg.appendChild(svgNode('text',{x:width/2,y:117,'text-anchor':'middle',fill:'#6e8881','font-size':14,'font-family':'inherit'},'ข้อมูลไม่เพียงพอสำหรับแสดงการคาดการณ์'));
      this.svg.appendChild(svgNode('text',{x:width/2,y:143,'text-anchor':'middle',fill:'#8ca198','font-size':12,'font-family':'inherit'},'รอข้อมูลเซนเซอร์ที่ใช้งานได้'));
      return;
    }
    this.canRead=true;
    const threshold=isNumber(this.data.threshold)?this.data.threshold:5;
    const xs=all.map(p=>p.minutes);
    this.domainX=[Math.min(-60,...xs),Math.max(180,...xs)];
    const min=Math.min(threshold,...values),max=Math.max(threshold,...values);
    const padding=Math.max(.45,(max-min)*.16);
    this.domainY=[Math.max(0,Math.floor((min-padding)*2)/2),Math.ceil((max+padding)*2)/2];
    if(this.domainY[1]-this.domainY[0]<1)this.domainY[1]=this.domainY[0]+1;
    const [xmin,xmax]=this.domainX,[ymin,ymax]=this.domainY,p=this.plot;
    this.x=value=>p.left+(value-xmin)/(xmax-xmin)*(p.right-p.left);
    this.y=value=>p.bottom-(value-ymin)/(ymax-ymin)*(p.bottom-p.top);
    const label=(text,x,y,attrs={})=>this.svg.appendChild(svgNode('text',{x,y,fill:'#61756b','font-size':12,'font-family':'inherit',...attrs},text));
    label('DO · mg/L',p.left,15,{fill:'#5b7a71','font-size':11});
    const yStep=[.25,.5,1,2,3,5,10,20].find(step=>(ymax-ymin)/step<=5)??20;
    for(let tick=Math.ceil(ymin/yStep)*yStep;tick<=ymax+1e-9;tick+=yStep) {
      const yy=this.y(tick);
      this.svg.appendChild(svgNode('line',{x1:p.left,y1:yy,x2:p.right,y2:yy,stroke:'#e4ece8','stroke-width':1}));
      label(tick.toFixed(yStep<1?1:0),p.left-9,yy+4,{'text-anchor':'end'});
    }
    let ticks;
    if(width<430)ticks=[xmin,0,xmax];
    else {
      const step=[30,60,120,180,240,360].find(v=>(xmax-xmin)/v<=5)??360;
      ticks=[];
      for(let t=Math.ceil(xmin/step)*step;t<=xmax;t+=step)ticks.push(t);
      if(!ticks.includes(0))ticks.push(0);
      ticks.sort((a,b)=>a-b);
    }
    ticks.forEach(tick=>label(this._time(tick),this.x(tick),height-19,{'text-anchor':tick===xmin?'start':tick===xmax?'end':'middle',fill:tick===0?'#345c52':'#7b928b'}));
    label('เวลาไทย',p.right,height-2,{'text-anchor':'end','font-size':11});
    const clip=svgNode('clipPath',{id:`${this.id}-clip`});
    clip.appendChild(svgNode('rect',{x:p.left,y:p.top,width:p.right-p.left,height:p.bottom-p.top}));
    const defs=svgNode('defs');defs.appendChild(clip);this.svg.appendChild(defs);
    const marks=svgNode('g',{'clip-path':`url(#${this.id}-clip)`});
    this.svg.appendChild(marks);
    for(const series of this.series) {
      if(series.key!=='history') {
        let segment=[];
        const flush=()=>{
          if(segment.length>1) {
            const d=segment.map((point,i)=>`${i?'L':'M'}${this.x(point.minutes)},${this.y(Math.max(point.low,point.high))}`).join(' ')+segment.slice().reverse().map(point=>` L${this.x(point.minutes)},${this.y(Math.min(point.low,point.high))}`).join(' ')+' Z';
            marks.appendChild(svgNode('path',{d,fill:series.color,'fill-opacity':.11,stroke:'none'}));
          }
          segment=[];
        };
        for(const point of series.points) {if(isNumber(point.low)&&isNumber(point.high)&&isNumber(point.value))segment.push(point);else flush();}flush();
      }
    }
    const thresholdY=this.y(threshold);
    marks.appendChild(svgNode('line',{x1:p.left,y1:thresholdY,x2:p.right,y2:thresholdY,stroke:'#bca58c','stroke-width':1,'stroke-dasharray':'4 5'}));
    for(const series of this.series) {
      let d='',connected=false;
      for(const point of series.points) {
        if(!isNumber(point.value)){connected=false;continue;}
        d+=`${connected?'L':'M'}${this.x(point.minutes)},${this.y(point.value)} `;
        connected=true;
      }
      if(d)marks.appendChild(svgNode('path',{d:d.trim(),fill:'none',stroke:series.color,'stroke-width':series.key==='proposed'?2.5:2.1,'stroke-linecap':'round','stroke-linejoin':'round'}));
      for(const point of series.points.filter(p=>isNumber(p.value))) {
        const index=series.points.indexOf(point);
        if(series.points.length===1 || (!isNumber(series.points[index-1]?.value)&&!isNumber(series.points[index+1]?.value)))marks.appendChild(svgNode('circle',{cx:this.x(point.minutes),cy:this.y(point.value),r:2.6,fill:series.color}));
      }
    }
    this.svg.appendChild(svgNode('line',{x1:this.x(0),y1:p.top,x2:this.x(0),y2:p.bottom,stroke:'#a9beb4','stroke-width':1,'stroke-dasharray':'2 5'}));
    label('ตอนนี้',this.x(0)+5,p.top+12,{'font-size':11,fill:'#627f74'});
    label(`เกณฑ์ ${threshold.toFixed(1)}`,p.right-3,Math.max(p.top+12,thresholdY-6),{'text-anchor':'end','font-size':11,fill:'#967b5e'});
    this.guide=svgNode('g',{'pointer-events':'none',visibility:'hidden',display:'none'});
    this.guideLine=svgNode('line',{y1:p.top,y2:p.bottom,stroke:'#6f9285','stroke-width':1});
    this.guide.appendChild(this.guideLine);
    this.guideDots=this.series.map(series=>{const dot=svgNode('circle',{r:4,fill:series.color,stroke:'#fff','stroke-width':1.6});this.guide.appendChild(dot);return dot;});
    this.svg.appendChild(this.guide);
  }

  _interpolate(points, minute) {
    if(!points.length || minute<points[0].minutes || minute>points[points.length-1].minutes)return null;
    for(let i=0;i<points.length;i++) {
      const point=points[i];
      if(Math.abs(point.minutes-minute)<1e-7)return isNumber(point.value)?point:null;
      if(point.minutes>minute) {
        const previous=points[i-1];
        if(!previous||!isNumber(previous.value)||!isNumber(point.value))return null;
        const fraction=(minute-previous.minutes)/(point.minutes-previous.minutes);
        const interp=key=>isNumber(previous[key])&&isNumber(point[key])?previous[key]+(point[key]-previous[key])*fraction:null;
        return {minutes:minute,value:interp('value'),low:interp('low'),high:interp('high')};
      }
    }
    return null;
  }

  _pointer(event) {
    if(!this.canRead)return;
    const rect=this.svg.getBoundingClientRect();
    const x=(event.clientX-rect.left)*(this.width/(rect.width||this.width));
    if(x<this.plot.left||x>this.plot.right){this._hide();return;}
    const minute=this.domainX[0]+(x-this.plot.left)/(this.plot.right-this.plot.left)*(this.domainX[1]-this.domainX[0]);
    this._show(minute,false);
  }

  _show(minute,announce=false) {
    if(!this.canRead || !this.guide)return;
    this.cursorMinute=bound(minute,...this.domainX);
    const x=this.x(this.cursorMinute);
    this.guide.setAttribute('visibility','visible');this.guide.setAttribute('display','inline');this.guideLine.setAttribute('x1',x);this.guideLine.setAttribute('x2',x);
    this.tooltip.replaceChildren();
    const title=document.createElement('div');title.style.fontWeight='600';title.textContent=`${this._time(this.cursorMinute)} น. · DO (mg/L)`;this.tooltip.appendChild(title);
    const text=[title.textContent];
    this.series.forEach((series,index)=>{
      const point=this._interpolate(series.points,this.cursorMinute);
      const dot=this.guideDots[index];
      dot.setAttribute('visibility',point?'visible':'hidden');
      if(point){dot.setAttribute('cx',x);dot.setAttribute('cy',this.y(point.value));}
      if(!point)return;
      const row=document.createElement('div');
      const uncertainty=isNumber(point.low)&&isNumber(point.high)?` (${Math.min(point.low,point.high).toFixed(1)}–${Math.max(point.low,point.high).toFixed(1)})`:'';
      row.textContent=`${series.label}: ${point.value.toFixed(2)}${uncertainty}`;
      this.tooltip.appendChild(row);text.push(row.textContent);
    });
    this.tooltip.style.display='block';
    this.tooltip.style.left=`${bound(x+12,4,Math.max(4,this.width-224))}px`;
    this.tooltip.style.top='48px';
    if(announce)this.announcement.textContent=text.join(' ');
  }

  _hide() {
    this.tooltip.style.display='none';
    this.guide?.setAttribute('visibility','hidden');
    this.guide?.setAttribute('display','none');
  }

  _key(event) {
    if(!this.canRead || !['ArrowLeft','ArrowRight','Home','End','Escape'].includes(event.key))return;
    event.preventDefault();
    if(event.key==='Escape'){this._hide();return;}
    let value=isNumber(this.cursorMinute)?this.cursorMinute:0;
    if(event.key==='ArrowLeft')value-=15;
    if(event.key==='ArrowRight')value+=15;
    if(event.key==='Home')value=this.domainX[0];
    if(event.key==='End')value=this.domainX[1];
    this._show(value,true);
  }
}
