==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys
==> Build failed 😞
  Try `npm i --save-dev @types/express` if it exists or add a new declaration (.d.ts) file containing `declare module 'express';`
src/modules/notifications/notifications.controller.ts(2,26): error TS7016: Could not find a declaration file for module 'express'. '/opt/render/project/src/backend/node_modules/express/index.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/nodemailer` if it exists or add a new declaration (.d.ts) file containing `declare module 'nodemailer';`
src/modules/email/email.service.ts(3,24): error TS7016: Could not find a declaration file for module 'nodemailer'. '/opt/render/project/src/backend/node_modules/nodemailer/lib/nodemailer.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/express` if it exists or add a new declaration (.d.ts) file containing `declare module 'express';`
src/modules/auth/jwt.strategy.ts(5,25): error TS7016: Could not find a declaration file for module 'express'. '/opt/render/project/src/backend/node_modules/express/index.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/passport-jwt` if it exists or add a new declaration (.d.ts) file containing `declare module 'passport-jwt';`
src/modules/auth/jwt.strategy.ts(4,38): error TS7016: Could not find a declaration file for module 'passport-jwt'. '/opt/render/project/src/backend/node_modules/passport-jwt/lib/index.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/express` if it exists or add a new declaration (.d.ts) file containing `declare module 'express';`
src/modules/auth/auth.controller.ts(2,26): error TS7016: Could not find a declaration file for module 'express'. '/opt/render/project/src/backend/node_modules/express/index.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/cookie-parser` if it exists or add a new declaration (.d.ts) file containing `declare module 'cookie-parser';`
src/main.ts(7,26): error TS7016: Could not find a declaration file for module 'cookie-parser'. '/opt/render/project/src/backend/node_modules/cookie-parser/index.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/express` if it exists or add a new declaration (.d.ts) file containing `declare module 'express';`
src/main.ts(6,34): error TS7016: Could not find a declaration file for module 'express'. '/opt/render/project/src/backend/node_modules/express/index.js' implicitly has an 'any' type.
> tsc && tsc-alias
> backend@0.1.0 build
Tip: Want to react to database changes in your app as they happen? Discover how with Pulse: https://pris.ly/tip-1-pulse
Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 324ms
Prisma schema loaded from prisma/schema.prisma
Run `npm audit` for details.
  npm audit fix --force
To address all issues (including breaking changes), run:
  npm audit fix
To address issues that do not require attention, run:
5 moderate severity vulnerabilities
  run `npm fund` for details
48 packages are looking for funding
added 239 packages, and audited 240 packages in 5s
==> Running build command 'npm install && npx prisma generate && npm run build'...
==> Installing Node.js version 20.19.0...
==> Docs on specifying a Node.js version: https://render.com/docs/node-version
==> Using Node.js version 20.19.0 via /opt/render/project/src/backend/.nvmrc
==> Downloaded 282MB in 2s. Extraction took 3s.
==> Checking out commit 341696616e9aed55ed903c42ec28b88b82785314 in branch main
==> Cloning from https://github.com/Nobody664/Sistema_de_ventas
==> Downloading cache...