==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys
==> Exited with status 1
}
  }
    id: '28bdfa202180119fa23a1'
  moduleRef: {
  },
    id: 'eb04b66308c82b65fda86'
  metadata: {
  },
    name: [class PrismaService extends t]
    ],
      [class PrismaService extends t]
      [class Reflector],
    dependencies: [
    index: 1,
  context: {
  type: 'TenantGuard',
    at async /opt/render/project/src/backend/node_modules/@nestjs/core/injector/instance-loader.js:41:13 {
    at async InstanceLoader.createInstancesOfInjectables (/opt/render/project/src/backend/node_modules/@nestjs/core/injector/instance-loader.js:79:9)
    at async Promise.all (index 2)
    at async /opt/render/project/src/backend/node_modules/@nestjs/core/injector/instance-loader.js:80:13
    at async Injector.loadInjectable (/opt/render/project/src/backend/node_modules/@nestjs/core/injector/injector.js:99:9)
    at async Injector.loadInstance (/opt/render/project/src/backend/node_modules/@nestjs/core/injector/injector.js:75:13)
    at async Injector.resolveConstructorParams (/opt/render/project/src/backend/node_modules/@nestjs/core/injector/injector.js:169:27)
    at async Promise.all (index 1)
    at async resolveParam (/opt/render/project/src/backend/node_modules/@nestjs/core/injector/injector.js:140:38)
    at Injector.lookupComponentInParentModules (/opt/render/project/src/backend/node_modules/@nestjs/core/injector/injector.js:290:19)
For more common dependency resolution issues, see: https://docs.nestjs.com/faq/common-errors
  })
    imports: [ /* the Module containing PrismaService */ ]
  @Module({
- If PrismaService is exported from a separate @Module, is that module imported within AuditModule?
- If PrismaService is a provider, is it part of the current AuditModule?
- Is AuditModule a valid NestJS module?
Potential solutions:
[Nest] 85  - 10/04/2026, 7:03:29 PM   ERROR [ExceptionHandler] UnknownDependenciesException [Error]: Nest can't resolve dependencies of the TenantGuard (Reflector, ?). Please make sure that the argument PrismaService at index [1] is available in the AuditModule module.
[Nest] 85  - 10/04/2026, 7:03:29 PM     LOG [InstanceLoader] ConfigModule dependencies initialized +0ms
[Nest] 85  - 10/04/2026, 7:03:29 PM     LOG [InstanceLoader] ConfigModule dependencies initialized +1ms