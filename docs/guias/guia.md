You are a senior NestJS + TypeScript + DevOps engineer.

Fix my project so it builds and deploys correctly on Render.

### Context:

* Monorepo with `/backend` (NestJS) and `/frontend`
* Backend uses Prisma ORM and TypeScript
* Current issues:

  * Node version mismatch (EBADENGINE warnings)
  * Prisma requires Node >=20.19.0
  * Build fails with `npx nest build`
  * TypeScript errors (missing @types for express, pg, etc.)
  * Invalid tsconfig option: `"ignoreDeprecations": "6.0"`

---

### Tasks:

1. **Fix Node compatibility**

   * Ensure Node version is exactly 20.19.0 (stable for Prisma)
   * Add `.nvmrc` and `engines` in package.json

2. **Fix build process**

   * Replace `npx nest build` with `npm run build`
   * Ensure scripts:

     ```json
     "build": "nest build",
     "start:prod": "node dist/main.js"
     ```

3. **Fix TypeScript configuration**

   * Remove or correct invalid `ignoreDeprecations`
   * Ensure tsconfig is valid for NestJS

4. **Fix missing types**
   Install dev dependencies:

   * @types/express
   * @types/cookie-parser
   * @types/passport-jwt
   * @types/pg

5. **Ensure dependencies**

   * Install @nestjs/cli as devDependency
   * Ensure Prisma is correctly installed and generated

6. **Render configuration**

   * Root directory: backend
   * Build: `npm install && npm run build`
   * Start: `npm run start:prod`

---

### Output:

* Provide FULL corrected `backend/package.json`
* Provide corrected `tsconfig.json`
* List all changes made
* Ensure project builds without errors

Do not ask questions. Fix everything.
