# EBI Farm deployment

- Live URL: https://ebi-farm-demo.gon1122.chatgpt.site/
- Provider: ChatGPT Sites.
- Published: 27 November 2026, approximately 18:04 Asia/Bangkok.
- Confirmed deployment state: `succeeded` / `ready`.
- Audience: owner only. Visitors must use Continue with ChatGPT and be the authorized owner. This is not a public sharing link.
- Application source: GitHub commit `55359d71c3c585a8b7749c32cf6357bc104c682a` from PR #2.
- Hosted source commit: `c98b34097dffa2d88345070556c77eb3d27ba377`, containing the application plus the Sites hosting manifest.
- Site project: `appgprj_6b09634e78ac81918bb77d0d9e182dec`.
- Site version: `appgprj_6b09634e78ac81918bb77d0d9e182dec~appgver_7c21e1871724819189c2e21f987a5ed8`.
- Deployment: `appgprj_6b09634e78ac81918bb77d0d9e182dec~appgdep_2c050b44b3a081919d4cbd49a6adbb45`.

The deployment serves the static `dist/` output. No backend, API key, sensor connection, or equipment control is involved. GitHub pushes do not automatically update this deployment; publish a new Sites version to apply future changes.

## Verification

The deployed asset package matched the previously checked application source. All 10 published files and nine local resource references were verified before upload, and the build completed successfully. The hosting service confirmed successful publication. The production URL was opened in a browser and displayed the expected ChatGPT access gate. Application UI behavior was verified before deployment, as recorded in [verification.md](verification.md); the production application was not re-tested past the access gate.

## Netlify preparation

An empty `ebi-farm` project was created in the existing Netlify team while preparing deployment. No application files were uploaded there because browser sign-in was cancelled. The working deployment is the Sites URL above.
