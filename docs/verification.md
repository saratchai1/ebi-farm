# Demo verification

Checked on 27 November 2026 using the local managed preview in Chrome. All displayed farm readings and the downloaded CSV are synthetic.

## Automated checks

- `npm run check`: JavaScript syntax, local module imports, HTML resources, duplicate IDs, and literal app selectors.
- `npm test`: 16 model tests, including oxygen balance, interventions, power availability, missing sensors, scenario differences, and bounded finite output.
- `npm run build`: static output generated in `dist/` without installing dependencies.

## Browser checks

- Desktop dashboard, four-pond scene, metric cards, scenario switching, and forecast render.
- Heavy rain changes the selected pond's water and weather readings.
- Sensor loss shows unknown DO, removes forecasts, and disables simulation.
- During a power outage, six proposed aerators plus backup power change the proposed curve while the current equipment remains off. The current risk and observed readings do not change to the hypothetical plan.
- Time is independent per pond: P01 at 180 minutes, P02 at 0, then P01 restored to 180.
- Help dialog opens and closes with Escape.
- CSV download: 133 data rows and 13 columns in the default scenario; all rows carry `SYNTHETIC_DEMO_NOT_REAL_FARM`. Ten metadata rows record the model version, elapsed time, equipment, feed, backup power, and thresholds.
- Responsive CSS checked in same-origin frames at 320 and 390 CSS pixels with no horizontal overflow. The mobile forecast and controls remain readable. This is a viewport check, not testing on physical phones.
- No application console errors observed. Browser-extension metadata errors were unrelated to the application.

Screenshots: [desktop](screenshots/desktop.jpg), [390 px mobile forecast](screenshots/mobile.jpg). The mobile screenshot includes the temporary viewport harness; that harness is not shipped.

These checks verify demo behavior, not biological accuracy or real-farm suitability. Model assumptions and limitations are in [model-notes.md](model-notes.md).
