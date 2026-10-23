Necesito que migres y corrijas profesionalmente mi proyecto Node.js + TypeScript + Prisma para producción y despliegue en Render/Vercel.

Problemas actuales:

* TypeScript 6 muestra:

  * Option 'baseUrl' is deprecated
  * Option 'moduleResolution=node10' is deprecated
* Next.js 16 detecta conflicto entre:

  * middleware.ts
  * proxy.ts
* El proyecto debe quedar listo para producción enterprise-grade.

Objetivos:

1. Corregir tsconfig.json usando configuración moderna compatible con Node 20 LTS.
2. Reemplazar moduleResolution=node10 por NodeNext.
3. Corregir aliases y paths correctamente.
4. Mantener compatibilidad con Prisma.
5. Eliminar configuraciones deprecated.
6. Migrar middleware.ts hacia proxy.ts si existe frontend Next.js.
7. Validar build local y producción.
8. Optimizar package.json scripts.
9. Agregar manejo correcto de variables de entorno.
10. Preparar arquitectura limpia tipo:

* frontend/
* backend/
* shared/

11. Garantizar compatibilidad con:

* Render
* Vercel
* PostgreSQL

12. Implementar configuración segura:

* strict mode
* eslint
* typecheck
* prisma generate

13. Corregir posibles imports incompatibles con Linux/Vercel.
14. Evitar futuras incompatibilidades de TypeScript 7.
15. Mantener arquitectura enterprise con:

* RBAC
* JWT
* Prisma
* modular architecture

También quiero:

* estructura final recomendada
* tsconfig final
* package.json final
* scripts recomendados
* configuración de deploy profesional
* recomendaciones DevOps
* CI/CD básico con GitHub Actions
* mejores prácticas de seguridad y escalabilidad
