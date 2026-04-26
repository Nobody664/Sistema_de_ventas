2026-04-26T00:37:08.780387596Z src/modules/payments/payment-settings.service.ts:34:24 - error TS2551: Property 'paymentSettings' does not exist on type 'PrismaService'. Did you mean 'paymentSetting'?
2026-04-26T00:37:08.780389776Z 
2026-04-26T00:37:08.780392246Z 34     return this.prisma.paymentSettings.upsert({
2026-04-26T00:37:08.780394206Z                           ~~~~~~~~~~~~~~~
2026-04-26T00:37:08.780396056Z 
2026-04-26T00:37:08.780397936Z   node_modules/.prisma/client/index.d.ts:603:7
2026-04-26T00:37:08.780399956Z     603   get paymentSetting(): Prisma.PaymentSettingDelegate<ExtArgs, ClientOptions>;
2026-04-26T00:37:08.780401986Z               ~~~~~~~~~~~~~~
2026-04-26T00:37:08.780403946Z     'paymentSetting' is declared here.
2026-04-26T00:37:08.780405886Z src/modules/payments/payment-settings.service.ts:45:40 - error TS2551: Property 'paymentSettings' does not exist on type 'PrismaService'. Did you mean 'paymentSetting'?
2026-04-26T00:37:08.780407756Z 
2026-04-26T00:37:08.780409706Z 45     const settings = await this.prisma.paymentSettings.findUnique({
2026-04-26T00:37:08.780411776Z                                           ~~~~~~~~~~~~~~~
2026-04-26T00:37:08.780413606Z 
2026-04-26T00:37:08.780415566Z   node_modules/.prisma/client/index.d.ts:603:7
2026-04-26T00:37:08.780417597Z     603   get paymentSetting(): Prisma.PaymentSettingDelegate<ExtArgs, ClientOptions>;
2026-04-26T00:37:08.780419746Z               ~~~~~~~~~~~~~~
2026-04-26T00:37:08.780421677Z     'paymentSetting' is declared here.
2026-04-26T00:37:08.780423626Z src/modules/payments/payment-settings.service.ts:60:24 - error TS2339: Property 'paymentProof' does not exist on type 'PrismaService'.
2026-04-26T00:37:08.780425497Z 
2026-04-26T00:37:08.780427447Z 60     return this.prisma.paymentProof.create({
2026-04-26T00:37:08.780429387Z                           ~~~~~~~~~~~~
2026-04-26T00:37:08.780434177Z src/modules/payments/payment-settings.service.ts:74:24 - error TS2339: Property 'paymentProof' does not exist on type 'PrismaService'.
2026-04-26T00:37:08.780436057Z 
2026-04-26T00:37:08.780437967Z 74     return this.prisma.paymentProof.findMany({
2026-04-26T00:37:08.780439977Z                           ~~~~~~~~~~~~
2026-04-26T00:37:08.780442157Z src/modules/payments/payment-settings.service.ts:81:24 - error TS2339: Property 'paymentProof' does not exist on type 'PrismaService'.
2026-04-26T00:37:08.780443987Z 
2026-04-26T00:37:08.780445857Z 81     return this.prisma.paymentProof.findMany({
2026-04-26T00:37:08.780447797Z                           ~~~~~~~~~~~~
2026-04-26T00:37:08.780449807Z src/modules/payments/payment-settings.service.ts:92:37 - error TS2339: Property 'paymentProof' does not exist on type 'PrismaService'.
2026-04-26T00:37:08.780451667Z 
2026-04-26T00:37:08.780453627Z 92     const proof = await this.prisma.paymentProof.update({
2026-04-26T00:37:08.780455677Z                                        ~~~~~~~~~~~~
2026-04-26T00:37:08.780457707Z src/modules/payments/payment-settings.service.ts:113:37 - error TS2339: Property 'paymentProof' does not exist on type 'PrismaService'.
2026-04-26T00:37:08.780459557Z 
2026-04-26T00:37:08.780461507Z 113     const proof = await this.prisma.paymentProof.findUnique({
2026-04-26T00:37:08.780463447Z                                         ~~~~~~~~~~~~
2026-04-26T00:37:08.780465487Z src/modules/payments/payments.service.ts:102:27 - error TS2339: Property 'currency' does not exist on type '{ subscription: { company: { status: CompanyStatus; email: string | null; phone: string | null; id: string; createdAt: Date; updatedAt: Date; name: string; slug: string; ... 5 more ...; trialEndsAt: Date | null; }; plan: { ...; }; } & { ...; }; } & { ...; }'.
2026-04-26T00:37:08.780467367Z 
2026-04-26T00:37:08.780469277Z 102         currency: payment.currency,
2026-04-26T00:37:08.780471207Z                               ~~~~~~~~
2026-04-26T00:37:08.780496278Z src/modules/payments/payments.service.ts:126:9 - error TS2353: Object literal may only specify known properties, and 'transactionId' does not exist in type '(Without<PaymentUpdateInput, PaymentUncheckedUpdateInput> & PaymentUncheckedUpdateInput) | (Without<...> & PaymentUpdateInput)'.
2026-04-26T00:37:08.780503998Z 
2026-04-26T00:37:08.780508128Z 126         transactionId: paymentDate ? `manual-${Date.now()}` : `paid-${Date.now()}`,
2026-04-26T00:37:08.780512178Z             ~~~~~~~~~~~~~
2026-04-26T00:37:08.780515278Z 
2026-04-26T00:37:08.780518588Z   node_modules/.prisma/client/index.d.ts:18673:5
2026-04-26T00:37:08.780521058Z     18673     data: XOR<PaymentUpdateInput, PaymentUncheckedUpdateInput>
2026-04-26T00:37:08.780523508Z               ~~~~
2026-04-26T00:37:08.780527298Z     The expected type comes from property 'data' which is declared here on type '{ select?: PaymentSelect<DefaultArgs> | null | undefined; omit?: PaymentOmit<DefaultArgs> | null | undefined; include?: PaymentInclude<...> | ... 1 more ... | undefined; data: (Without<...> & PaymentUncheckedUpdateInput) | (Without<...> & PaymentUpdateInput); where: PaymentWhereUniqueInput; }'
2026-04-26T00:37:08.780538248Z src/modules/payments/payments.service.ts:135:34 - error TS2551: Property 'subscription' does not exist on type '{ status: PaymentStatus; id: string; createdAt: Date; updatedAt: Date; subscriptionId: string; amount: Decimal; provider: PaymentProvider; providerPaymentId: string | null; paidAt: Date | null; }'. Did you mean 'subscriptionId'?
2026-04-26T00:37:08.780549899Z 
2026-04-26T00:37:08.780552949Z 135     const subscription = updated.subscription;
2026-04-26T00:37:08.780556739Z                                      ~~~~~~~~~~~~
2026-04-26T00:37:08.780560189Z src/modules/payments/payments.service.ts:345:9 - error TS2353: Object literal may only specify known properties, and 'provider' does not exist in type 'Without<SubscriptionUpdateInput, SubscriptionUncheckedUpdateInput> & SubscriptionUncheckedUpdateInput'.
2026-04-26T00:37:08.780562579Z 
2026-04-26T00:37:08.780565179Z 345         provider: 'MERCADOPAGO',
2026-04-26T00:37:08.780567619Z             ~~~~~~~~
2026-04-26T00:37:08.780569939Z 
2026-04-26T00:37:08.780572689Z   node_modules/.prisma/client/index.d.ts:7999:5
2026-04-26T00:37:08.780575509Z     7999     update: XOR<SubscriptionUpdateInput, SubscriptionUncheckedUpdateInput>
2026-04-26T00:37:08.780577979Z              ~~~~~~
2026-04-26T00:37:08.780580549Z     The expected type comes from property 'update' which is declared here on type '{ select?: SubscriptionSelect<DefaultArgs> | null | undefined; omit?: SubscriptionOmit<DefaultArgs> | null | undefined; include?: SubscriptionInclude<...> | ... 1 more ... | undefined; where: SubscriptionWhereUniqueInput; create: (Without<...> & SubscriptionUncheckedCreateInput) | (Without<...> & SubscriptionCreateI...'
2026-04-26T00:37:08.780583319Z src/modules/payments/payments.service.ts:352:9 - error TS2353: Object literal may only specify known properties, and 'provider' does not exist in type 'Without<SubscriptionCreateInput, SubscriptionUncheckedCreateInput> & SubscriptionUncheckedCreateInput'.
2026-04-26T00:37:08.780585629Z 
2026-04-26T00:37:08.780588149Z 352         provider: 'MERCADOPAGO',
2026-04-26T00:37:08.780590609Z             ~~~~~~~~
2026-04-26T00:37:08.78059294Z 
2026-04-26T00:37:08.780595529Z   node_modules/.prisma/client/index.d.ts:7995:5
2026-04-26T00:37:08.780598089Z     7995     create: XOR<SubscriptionCreateInput, SubscriptionUncheckedCreateInput>
2026-04-26T00:37:08.7806005Z              ~~~~~~
2026-04-26T00:37:08.78060339Z     The expected type comes from property 'create' which is declared here on type '{ select?: SubscriptionSelect<DefaultArgs> | null | undefined; omit?: SubscriptionOmit<DefaultArgs> | null | undefined; include?: SubscriptionInclude<...> | ... 1 more ... | undefined; where: SubscriptionWhereUniqueInput; create: (Without<...> & SubscriptionUncheckedCreateInput) | (Without<...> & SubscriptionCreateI...'
2026-04-26T00:37:08.78060605Z src/modules/payments/payments.service.ts:369:11 - error TS2353: Object literal may only specify known properties, and 'transactionId' does not exist in type 'Without<PaymentCreateInput, PaymentUncheckedCreateInput> & PaymentUncheckedCreateInput'.
2026-04-26T00:37:08.78060842Z 
2026-04-26T00:37:08.78061086Z 369           transactionId: transactionId || `mp-${Date.now()}`,
2026-04-26T00:37:08.78061338Z               ~~~~~~~~~~~~~
2026-04-26T00:37:08.78061572Z 
2026-04-26T00:37:08.78061814Z   node_modules/.prisma/client/index.d.ts:18617:5
2026-04-26T00:37:08.78062056Z     18617     data: XOR<PaymentCreateInput, PaymentUncheckedCreateInput>
2026-04-26T00:37:08.78062626Z               ~~~~
2026-04-26T00:37:08.78062898Z     The expected type comes from property 'data' which is declared here on type '{ select?: PaymentSelect<DefaultArgs> | null | undefined; omit?: PaymentOmit<DefaultArgs> | null | undefined; include?: PaymentInclude<...> | ... 1 more ... | undefined; data: (Without<...> & PaymentUncheckedCreateInput) | (Without<...> & PaymentCreateInput); }'
2026-04-26T00:37:08.78063194Z src/modules/products/products.service.ts:181:27 - error TS2353: Object literal may only specify known properties, and 'role' does not exist in type 'EmployeeWhereInput'.
2026-04-26T00:37:08.78063425Z 
2026-04-26T00:37:08.7806367Z 181       where: { companyId, role: 'COMPANY_ADMIN', isActive: true },
2026-04-26T00:37:08.78063914Z                               ~~~~
2026-04-26T00:37:08.78064167Z src/modules/products/products.service.ts:266:9 - error TS2353: Object literal may only specify known properties, and 'status' does not exist in type 'ProductWhereInput'.
2026-04-26T00:37:08.78064399Z 
2026-04-26T00:37:08.78064637Z 266         status: 'ACTIVE',
2026-04-26T00:37:08.78064881Z             ~~~~~~
2026-04-26T00:37:08.780657741Z src/modules/products/products.service.ts:300:37 - error TS2345: Argument of type '({ category: { id: string; createdAt: Date; updatedAt: Date; name: string; companyId: string; slug: string; description: string | null; } | null; } & { id: string; createdAt: Date; ... 12 more ...; minStockLevel: number; })[]' is not assignable to parameter of type '{ name: string; sku: string; barcode: string | null; description: string | null; category: { name: string; } | null; costPrice: unknown; price: unknown; stockQuantity: number; minStockLevel: number; }[]'.
2026-04-26T00:37:08.780660921Z   Type '{ category: { id: string; createdAt: Date; updatedAt: Date; name: string; companyId: string; slug: string; description: string | null; } | null; } & { id: string; createdAt: Date; ... 12 more ...; minStockLevel: number; }' is not assignable to type '{ name: string; sku: string; barcode: string | null; description: string | null; category: { name: string; } | null; costPrice: unknown; price: unknown; stockQuantity: number; minStockLevel: number; }'.
2026-04-26T00:37:08.780663461Z     Types of property 'sku' are incompatible.
2026-04-26T00:37:08.780666041Z       Type 'string | null' is not assignable to type 'string'.
2026-04-26T00:37:08.780670221Z         Type 'null' is not assignable to type 'string'.
2026-04-26T00:37:08.780672591Z 
2026-04-26T00:37:08.780675061Z 300       return this.generateCsvExport(products);
2026-04-26T00:37:08.780677541Z                                         ~~~~~~~~
2026-04-26T00:37:08.780680101Z src/modules/products/products.service.ts:302:39 - error TS2345: Argument of type '({ category: { id: string; createdAt: Date; updatedAt: Date; name: string; companyId: string; slug: string; description: string | null; } | null; } & { id: string; createdAt: Date; ... 12 more ...; minStockLevel: number; })[]' is not assignable to parameter of type '{ name: string; sku: string; barcode: string | null; description: string | null; category: { name: string; } | null; costPrice: unknown; price: unknown; stockQuantity: number; minStockLevel: number; }[]'.
2026-04-26T00:37:08.780682611Z   Type '{ category: { id: string; createdAt: Date; updatedAt: Date; name: string; companyId: string; slug: string; description: string | null; } | null; } & { id: string; createdAt: Date; ... 12 more ...; minStockLevel: number; }' is not assignable to type '{ name: string; sku: string; barcode: string | null; description: string | null; category: { name: string; } | null; costPrice: unknown; price: unknown; stockQuantity: number; minStockLevel: number; }'.
2026-04-26T00:37:08.780688251Z     Types of property 'sku' are incompatible.
2026-04-26T00:37:08.780690821Z       Type 'string | null' is not assignable to type 'string'.
2026-04-26T00:37:08.780693321Z         Type 'null' is not assignable to type 'string'.
2026-04-26T00:37:08.780695631Z 
2026-04-26T00:37:08.780698071Z 302       return this.generateExcelExport(products);
2026-04-26T00:37:08.780700561Z                                           ~~~~~~~~
2026-04-26T00:37:08.780705521Z src/modules/products/products.service.ts:304:37 - error TS2345: Argument of type '({ category: { id: string; createdAt: Date; updatedAt: Date; name: string; companyId: string; slug: string; description: string | null; } | null; } & { id: string; createdAt: Date; ... 12 more ...; minStockLevel: number; })[]' is not assignable to parameter of type '{ name: string; sku: string; barcode: string | null; description: string | null; category: { name: string; } | null; costPrice: unknown; price: unknown; stockQuantity: number; minStockLevel: number; }[]'.
2026-04-26T00:37:08.780708161Z   Type '{ category: { id: string; createdAt: Date; updatedAt: Date; name: string; companyId: string; slug: string; description: string | null; } | null; } & { id: string; createdAt: Date; ... 12 more ...; minStockLevel: number; }' is not assignable to type '{ name: string; sku: string; barcode: string | null; description: string | null; category: { name: string; } | null; costPrice: unknown; price: unknown; stockQuantity: number; minStockLevel: number; }'.
2026-04-26T00:37:08.780710631Z     Types of property 'sku' are incompatible.
2026-04-26T00:37:08.780713042Z       Type 'string | null' is not assignable to type 'string'.
2026-04-26T00:37:08.780715631Z         Type 'null' is not assignable to type 'string'.
2026-04-26T00:37:08.780718051Z 
2026-04-26T00:37:08.780720562Z 304       return this.generatePdfExport(products);
2026-04-26T00:37:08.780723102Z                                         ~~~~~~~~
2026-04-26T00:37:08.780733662Z src/modules/reports/reports.service.ts:41:33 - error TS2353: Object literal may only specify known properties, and 'totalAmount' does not exist in type 'SaleItemSumAggregateInputType'.
2026-04-26T00:37:08.780736172Z 
2026-04-26T00:37:08.780738612Z 41         _sum: { quantity: true, totalAmount: true },
2026-04-26T00:37:08.780741052Z                                    ~~~~~~~~~~~
2026-04-26T00:37:08.780743312Z 
2026-04-26T00:37:08.780745792Z   node_modules/.prisma/client/index.d.ts:14303:5
2026-04-26T00:37:08.780748202Z     14303     _sum?: SaleItemSumAggregateInputType
2026-04-26T00:37:08.780750612Z               ~~~~
2026-04-26T00:37:08.780753112Z     The expected type comes from property '_sum' which is declared here on type '{ where?: SaleItemWhereInput | undefined; orderBy?: SaleItemOrderByWithAggregationInput | SaleItemOrderByWithAggregationInput[] | undefined; ... 8 more ...; _max?: SaleItemMaxAggregateInputType | undefined; } & { ...; }'
2026-04-26T00:37:08.780756152Z src/modules/reports/reports.service.ts:65:17 - error TS18048: 'p._sum' is possibly 'undefined'.
2026-04-26T00:37:08.780758472Z 
2026-04-26T00:37:08.780760862Z 65       quantity: p._sum.quantity || 0,
2026-04-26T00:37:08.780763342Z                    ~~~~~~
2026-04-26T00:37:08.780765792Z src/modules/reports/reports.service.ts:66:23 - error TS18048: 'p._sum' is possibly 'undefined'.
2026-04-26T00:37:08.780771163Z 
2026-04-26T00:37:08.780773603Z 66       revenue: Number(p._sum.totalAmount || 0),
2026-04-26T00:37:08.780776083Z                          ~~~~~~
2026-04-26T00:37:08.780778972Z src/modules/reports/reports.service.ts:66:30 - error TS2339: Property 'totalAmount' does not exist on type '{ quantity?: number | null | undefined; unitPrice?: Decimal | null | undefined; totalPrice?: Decimal | null | undefined; }'.
2026-04-26T00:37:08.780781343Z 
2026-04-26T00:37:08.780783733Z 66       revenue: Number(p._sum.totalAmount || 0),
2026-04-26T00:37:08.780786133Z                                 ~~~~~~~~~~~
2026-04-26T00:37:08.780788603Z src/modules/subscriptions/plan-upgrade-requests.service.ts:29:18 - error TS2561: Object literal may only specify known properties, but 'subscription' does not exist in type 'CompanyInclude<DefaultArgs>'. Did you mean to write 'subscriptions'?
2026-04-26T00:37:08.780790943Z 
2026-04-26T00:37:08.780793403Z 29       include: { subscription: { include: { plan: true } } },
2026-04-26T00:37:08.780795933Z                     ~~~~~~~~~~~~
2026-04-26T00:37:08.780825893Z 
2026-04-26T00:37:08.780836264Z   node_modules/.prisma/client/index.d.ts:4975:5
2026-04-26T00:37:08.780838853Z     4975     include?: CompanyInclude<ExtArgs> | null
2026-04-26T00:37:08.780841244Z              ~~~~~~~
2026-04-26T00:37:08.780843764Z     The expected type comes from property 'include' which is declared here on type '{ select?: CompanySelect<DefaultArgs> | null | undefined; omit?: CompanyOmit<DefaultArgs> | null | undefined; include?: CompanyInclude<...> | ... 1 more ... | undefined; where: CompanyWhereUniqueInput; }'
2026-04-26T00:37:08.780846744Z src/modules/subscriptions/plan-upgrade-requests.service.ts:36:41 - error TS2339: Property 'subscription' does not exist on type '{ status: CompanyStatus; email: string | null; phone: string | null; id: string; createdAt: Date; updatedAt: Date; name: string; slug: string; legalName: string | null; ... 4 more ...; trialEndsAt: Date | null; }'.
2026-04-26T00:37:08.780849054Z 
2026-04-26T00:37:08.780851634Z 36     const currentSubscription = company.subscription;
2026-04-26T00:37:08.780854354Z                                            ~~~~~~~~~~~~
2026-04-26T00:37:08.780856894Z src/modules/subscriptions/plan-upgrade-requests.service.ts:53:40 - error TS2551: Property 'paymentSettings' does not exist on type 'PrismaService'. Did you mean 'paymentSetting'?
2026-04-26T00:37:08.780859234Z 
2026-04-26T00:37:08.780861654Z 53     const settings = await this.prisma.paymentSettings.findUnique({
2026-04-26T00:37:08.780864124Z                                           ~~~~~~~~~~~~~~~
2026-04-26T00:37:08.780866414Z 
2026-04-26T00:37:08.780868854Z   node_modules/.prisma/client/index.d.ts:603:7
2026-04-26T00:37:08.780871474Z     603   get paymentSetting(): Prisma.PaymentSettingDelegate<ExtArgs, ClientOptions>;
2026-04-26T00:37:08.780873904Z               ~~~~~~~~~~~~~~
2026-04-26T00:37:08.780876324Z     'paymentSetting' is declared here.
2026-04-26T00:37:08.780878964Z src/modules/subscriptions/plan-upgrade-requests.service.ts:85:47 - error TS2339: Property 'provider' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.780885464Z 
2026-04-26T00:37:08.780895145Z 85         paymentMethod: existingPendingRequest.provider,
2026-04-26T00:37:08.780897765Z                                                  ~~~~~~~~
2026-04-26T00:37:08.780900355Z src/modules/subscriptions/plan-upgrade-requests.service.ts:99:9 - error TS2353: Object literal may only specify known properties, and 'currentPlanId' does not exist in type 'Without<PlanUpgradeRequestCreateInput, PlanUpgradeRequestUncheckedCreateInput> & PlanUpgradeRequestUncheckedCreateInput'.
2026-04-26T00:37:08.780902765Z 
2026-04-26T00:37:08.780905285Z 99         currentPlanId: currentSubscription.planId,
2026-04-26T00:37:08.780907785Z            ~~~~~~~~~~~~~
2026-04-26T00:37:08.780910105Z 
2026-04-26T00:37:08.780912505Z   node_modules/.prisma/client/index.d.ts:19714:5
2026-04-26T00:37:08.780915615Z     19714     data: XOR<PlanUpgradeRequestCreateInput, PlanUpgradeRequestUncheckedCreateInput>
2026-04-26T00:37:08.780918205Z               ~~~~
2026-04-26T00:37:08.780920815Z     The expected type comes from property 'data' which is declared here on type '{ select?: PlanUpgradeRequestSelect<DefaultArgs> | null | undefined; omit?: PlanUpgradeRequestOmit<DefaultArgs> | null | undefined; include?: PlanUpgradeRequestInclude<...> | ... 1 more ... | undefined; data: (Without<...> & PlanUpgradeRequestUncheckedCreateInput) | (Without<...> & PlanUpgradeRequestCreateInput); }'
2026-04-26T00:37:08.780923475Z src/modules/subscriptions/plan-upgrade-requests.service.ts:107:9 - error TS2353: Object literal may only specify known properties, and 'currentPlan' does not exist in type 'PlanUpgradeRequestInclude<DefaultArgs>'.
2026-04-26T00:37:08.780925905Z 
2026-04-26T00:37:08.780928355Z 107         currentPlan: true,
2026-04-26T00:37:08.780930875Z             ~~~~~~~~~~~
2026-04-26T00:37:08.780933305Z 
2026-04-26T00:37:08.780935795Z   node_modules/.prisma/client/index.d.ts:19710:5
2026-04-26T00:37:08.780938345Z     19710     include?: PlanUpgradeRequestInclude<ExtArgs> | null
2026-04-26T00:37:08.780940945Z               ~~~~~~~
2026-04-26T00:37:08.780943555Z     The expected type comes from property 'include' which is declared here on type '{ select?: PlanUpgradeRequestSelect<DefaultArgs> | null | undefined; omit?: PlanUpgradeRequestOmit<DefaultArgs> | null | undefined; include?: PlanUpgradeRequestInclude<...> | ... 1 more ... | undefined; data: (Without<...> & PlanUpgradeRequestUncheckedCreateInput) | (Without<...> & PlanUpgradeRequestCreateInput); }'
2026-04-26T00:37:08.780946175Z src/modules/subscriptions/plan-upgrade-requests.service.ts:116:23 - error TS2339: Property 'currentPlan' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.780948595Z 
2026-04-26T00:37:08.780951055Z 116         code: request.currentPlan.code,
2026-04-26T00:37:08.780953606Z                           ~~~~~~~~~~~
2026-04-26T00:37:08.780956206Z src/modules/subscriptions/plan-upgrade-requests.service.ts:117:23 - error TS2339: Property 'currentPlan' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.780958506Z 
2026-04-26T00:37:08.780960896Z 117         name: request.currentPlan.name,
2026-04-26T00:37:08.780963366Z                           ~~~~~~~~~~~
2026-04-26T00:37:08.780968916Z src/modules/subscriptions/plan-upgrade-requests.service.ts:120:23 - error TS2339: Property 'newPlan' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.780971296Z 
2026-04-26T00:37:08.780973696Z 120         code: request.newPlan.code,
2026-04-26T00:37:08.780976066Z                           ~~~~~~~
2026-04-26T00:37:08.780978436Z src/modules/subscriptions/plan-upgrade-requests.service.ts:121:23 - error TS2339: Property 'newPlan' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.780980756Z 
2026-04-26T00:37:08.780983086Z 121         name: request.newPlan.name,
2026-04-26T00:37:08.780985456Z                           ~~~~~~~
2026-04-26T00:37:08.780987966Z src/modules/subscriptions/plan-upgrade-requests.service.ts:122:31 - error TS2339: Property 'newPlan' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.780990326Z 
2026-04-26T00:37:08.780997946Z 122         priceMonthly: request.newPlan.priceMonthly.toString(),
2026-04-26T00:37:08.781000596Z                                   ~~~~~~~
2026-04-26T00:37:08.781004566Z src/modules/subscriptions/plan-upgrade-requests.service.ts:123:30 - error TS2339: Property 'newPlan' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.781007036Z 
2026-04-26T00:37:08.781009447Z 123         priceYearly: request.newPlan.priceYearly.toString(),
2026-04-26T00:37:08.781011907Z                                  ~~~~~~~
2026-04-26T00:37:08.781014347Z src/modules/subscriptions/plan-upgrade-requests.service.ts:125:30 - error TS2339: Property 'provider' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.781016667Z 
2026-04-26T00:37:08.781019057Z 125       paymentMethod: request.provider,
2026-04-26T00:37:08.781021427Z                                  ~~~~~~~~
2026-04-26T00:37:08.781024667Z src/modules/subscriptions/plan-upgrade-requests.service.ts:143:18 - error TS2353: Object literal may only specify known properties, and 'newPlan' does not exist in type 'PlanUpgradeRequestInclude<DefaultArgs>'.
2026-04-26T00:37:08.781027037Z 
2026-04-26T00:37:08.781029507Z 143       include: { newPlan: true, company: true },
2026-04-26T00:37:08.781031987Z                      ~~~~~~~
2026-04-26T00:37:08.781034287Z 
2026-04-26T00:37:08.781036677Z   node_modules/.prisma/client/index.d.ts:19510:5
2026-04-26T00:37:08.781039167Z     19510     include?: PlanUpgradeRequestInclude<ExtArgs> | null
2026-04-26T00:37:08.781041587Z               ~~~~~~~
2026-04-26T00:37:08.781044097Z     The expected type comes from property 'include' which is declared here on type '{ select?: PlanUpgradeRequestSelect<DefaultArgs> | null | undefined; omit?: PlanUpgradeRequestOmit<DefaultArgs> | null | undefined; include?: PlanUpgradeRequestInclude<...> | ... 1 more ... | undefined; where: PlanUpgradeRequestWhereUniqueInput; }'
2026-04-26T00:37:08.781049597Z src/modules/subscriptions/plan-upgrade-requests.service.ts:157:9 - error TS2353: Object literal may only specify known properties, and 'proofImageBase64' does not exist in type '(Without<PlanUpgradeRequestUpdateInput, PlanUpgradeRequestUncheckedUpdateInput> & PlanUpgradeRequestUncheckedUpdateInput) | (Without<...> & PlanUpgradeRequestUpdateInput)'.
2026-04-26T00:37:08.781051987Z 
2026-04-26T00:37:08.781054437Z 157         proofImageBase64: input.imageBase64,
2026-04-26T00:37:08.781056847Z             ~~~~~~~~~~~~~~~~
2026-04-26T00:37:08.781059177Z 
2026-04-26T00:37:08.781061567Z   node_modules/.prisma/client/index.d.ts:19770:5
2026-04-26T00:37:08.781064027Z     19770     data: XOR<PlanUpgradeRequestUpdateInput, PlanUpgradeRequestUncheckedUpdateInput>
2026-04-26T00:37:08.781066468Z               ~~~~
2026-04-26T00:37:08.781068977Z     The expected type comes from property 'data' which is declared here on type '{ select?: PlanUpgradeRequestSelect<DefaultArgs> | null | undefined; omit?: PlanUpgradeRequestOmit<DefaultArgs> | null | undefined; include?: PlanUpgradeRequestInclude<...> | ... 1 more ... | undefined; data: (Without<...> & PlanUpgradeRequestUncheckedUpdateInput) | (Without<...> & PlanUpgradeRequestUpdateInput); wh...'
2026-04-26T00:37:08.781071437Z src/modules/subscriptions/plan-upgrade-requests.service.ts:166:9 - error TS2353: Object literal may only specify known properties, and 'isActive' does not exist in type 'UserWhereInput'.
2026-04-26T00:37:08.781073757Z 
2026-04-26T00:37:08.781076148Z 166         isActive: true,
2026-04-26T00:37:08.781078638Z             ~~~~~~~~
2026-04-26T00:37:08.781081258Z src/modules/subscriptions/plan-upgrade-requests.service.ts:177:29 - error TS2551: Property 'company' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'. Did you mean 'companyId'?
2026-04-26T00:37:08.781083668Z 
2026-04-26T00:37:08.781086948Z 177         message: `${request.company.name} solicitó cambio al plan ${request.newPlan.name}. Requiere revisión.`,
2026-04-26T00:37:08.781089448Z                                 ~~~~~~~
2026-04-26T00:37:08.781096808Z src/modules/subscriptions/plan-upgrade-requests.service.ts:177:77 - error TS2339: Property 'newPlan' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.781099208Z 
2026-04-26T00:37:08.781101688Z 177         message: `${request.company.name} solicitó cambio al plan ${request.newPlan.name}. Requiere revisión.`,
2026-04-26T00:37:08.781104178Z                                                                                 ~~~~~~~
2026-04-26T00:37:08.781106618Z src/modules/subscriptions/plan-upgrade-requests.service.ts:199:9 - error TS2353: Object literal may only specify known properties, and 'currentPlan' does not exist in type 'PlanUpgradeRequestInclude<DefaultArgs>'.
2026-04-26T00:37:08.781108968Z 
2026-04-26T00:37:08.781112148Z 199         currentPlan: true,
2026-04-26T00:37:08.781114538Z             ~~~~~~~~~~~
2026-04-26T00:37:08.781117028Z src/modules/subscriptions/plan-upgrade-requests.service.ts:210:9 - error TS2353: Object literal may only specify known properties, and 'currentPlan' does not exist in type 'PlanUpgradeRequestInclude<DefaultArgs>'.
2026-04-26T00:37:08.781122218Z 
2026-04-26T00:37:08.781124749Z 210         currentPlan: true,
2026-04-26T00:37:08.781127029Z             ~~~~~~~~~~~
2026-04-26T00:37:08.781128958Z src/modules/subscriptions/plan-upgrade-requests.service.ts:224:9 - error TS2353: Object literal may only specify known properties, and 'currentPlan' does not exist in type 'PlanUpgradeRequestInclude<DefaultArgs>'.
2026-04-26T00:37:08.781130818Z 
2026-04-26T00:37:08.781132698Z 224         currentPlan: true,
2026-04-26T00:37:08.781134618Z             ~~~~~~~~~~~
2026-04-26T00:37:08.781136629Z src/modules/subscriptions/plan-upgrade-requests.service.ts:243:9 - error TS2353: Object literal may only specify known properties, and 'currentPlan' does not exist in type 'PlanUpgradeRequestInclude<DefaultArgs>'.
2026-04-26T00:37:08.781138549Z 
2026-04-26T00:37:08.781140529Z 243         currentPlan: true,
2026-04-26T00:37:08.781142529Z             ~~~~~~~~~~~
2026-04-26T00:37:08.781144449Z 
2026-04-26T00:37:08.781146509Z   node_modules/.prisma/client/index.d.ts:19510:5
2026-04-26T00:37:08.781148659Z     19510     include?: PlanUpgradeRequestInclude<ExtArgs> | null
2026-04-26T00:37:08.781150679Z               ~~~~~~~
2026-04-26T00:37:08.781152699Z     The expected type comes from property 'include' which is declared here on type '{ select?: PlanUpgradeRequestSelect<DefaultArgs> | null | undefined; omit?: PlanUpgradeRequestOmit<DefaultArgs> | null | undefined; include?: PlanUpgradeRequestInclude<...> | ... 1 more ... | undefined; where: PlanUpgradeRequestWhereUniqueInput; }'
2026-04-26T00:37:08.781154809Z src/modules/subscriptions/plan-upgrade-requests.service.ts:256:31 - error TS2551: Property 'company' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'. Did you mean 'companyId'?
2026-04-26T00:37:08.781156709Z 
2026-04-26T00:37:08.781158709Z 256     const adminUser = request.company.memberships[0]?.user;
2026-04-26T00:37:08.781160739Z                                   ~~~~~~~
2026-04-26T00:37:08.781162799Z src/modules/subscriptions/plan-upgrade-requests.service.ts:263:11 - error TS2353: Object literal may only specify known properties, and 'reviewedBy' does not exist in type '(Without<PlanUpgradeRequestUpdateInput, PlanUpgradeRequestUncheckedUpdateInput> & PlanUpgradeRequestUncheckedUpdateInput) | (Without<...> & PlanUpgradeRequestUpdateInput)'.
2026-04-26T00:37:08.781164749Z 
2026-04-26T00:37:08.781166879Z 263           reviewedBy: reviewerId,
2026-04-26T00:37:08.781168899Z               ~~~~~~~~~~
2026-04-26T00:37:08.781170729Z 
2026-04-26T00:37:08.781172609Z   node_modules/.prisma/client/index.d.ts:19770:5
2026-04-26T00:37:08.781174629Z     19770     data: XOR<PlanUpgradeRequestUpdateInput, PlanUpgradeRequestUncheckedUpdateInput>
2026-04-26T00:37:08.781176609Z               ~~~~
2026-04-26T00:37:08.781178559Z     The expected type comes from property 'data' which is declared here on type '{ select?: PlanUpgradeRequestSelect<DefaultArgs> | null | undefined; omit?: PlanUpgradeRequestOmit<DefaultArgs> | null | undefined; include?: PlanUpgradeRequestInclude<...> | ... 1 more ... | undefined; data: (Without<...> & PlanUpgradeRequestUncheckedUpdateInput) | (Without<...> & PlanUpgradeRequestUpdateInput); wh...'
2026-04-26T00:37:08.78118685Z src/modules/subscriptions/plan-upgrade-requests.service.ts:270:83 - error TS2551: Property 'company' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'. Did you mean 'companyId'?
2026-04-26T00:37:08.781188839Z 
2026-04-26T00:37:08.78119077Z 270         await this.emailService.sendSubscriptionRejected(adminUser.email, request.company.name);
2026-04-26T00:37:08.78119279Z                                                                                       ~~~~~~~
2026-04-26T00:37:08.78119478Z src/modules/subscriptions/plan-upgrade-requests.service.ts:290:54 - error TS2339: Property 'newPlan' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.78119664Z 
2026-04-26T00:37:08.78120014Z 290       endDate.setMonth(endDate.getMonth() + (request.newPlan.billingCycle === 'YEARLY' ? 12 : 1));
2026-04-26T00:37:08.7812023Z                                                          ~~~~~~~
2026-04-26T00:37:08.78120444Z src/modules/subscriptions/plan-upgrade-requests.service.ts:295:27 - error TS2551: Property 'newPlanId' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'. Did you mean 'planId'?
2026-04-26T00:37:08.78120632Z 
2026-04-26T00:37:08.78120825Z 295           planId: request.newPlanId,
2026-04-26T00:37:08.78121025Z                               ~~~~~~~~~
2026-04-26T00:37:08.78121227Z src/modules/subscriptions/plan-upgrade-requests.service.ts:296:33 - error TS2339: Property 'newPlan' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.7812141Z 
2026-04-26T00:37:08.78121615Z 296           billingCycle: request.newPlan.billingCycle,
2026-04-26T00:37:08.78121823Z                                     ~~~~~~~
2026-04-26T00:37:08.7812205Z src/modules/subscriptions/plan-upgrade-requests.service.ts:300:11 - error TS2353: Object literal may only specify known properties, and 'provider' does not exist in type '(Without<SubscriptionUpdateInput, SubscriptionUncheckedUpdateInput> & SubscriptionUncheckedUpdateInput) | (Without<...> & SubscriptionUpdateInput)'.
2026-04-26T00:37:08.78122236Z 
2026-04-26T00:37:08.78122429Z 300           provider: request.provider,
2026-04-26T00:37:08.78122634Z               ~~~~~~~~
2026-04-26T00:37:08.78122818Z 
2026-04-26T00:37:08.78123011Z   node_modules/.prisma/client/index.d.ts:7917:5
2026-04-26T00:37:08.78123218Z     7917     data: XOR<SubscriptionUpdateInput, SubscriptionUncheckedUpdateInput>
2026-04-26T00:37:08.78123448Z              ~~~~
2026-04-26T00:37:08.78123653Z     The expected type comes from property 'data' which is declared here on type '{ select?: SubscriptionSelect<DefaultArgs> | null | undefined; omit?: SubscriptionOmit<DefaultArgs> | null | undefined; include?: SubscriptionInclude<...> | ... 1 more ... | undefined; data: (Without<...> & SubscriptionUncheckedUpdateInput) | (Without<...> & SubscriptionUpdateInput); where: SubscriptionWhereUniqueIn...'
2026-04-26T00:37:08.78123858Z src/modules/subscriptions/plan-upgrade-requests.service.ts:300:29 - error TS2339: Property 'provider' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.78124294Z 
2026-04-26T00:37:08.781244891Z 300           provider: request.provider,
2026-04-26T00:37:08.781246851Z                                 ~~~~~~~~
2026-04-26T00:37:08.78124888Z src/modules/subscriptions/plan-upgrade-requests.service.ts:307:29 - error TS2339: Property 'provider' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.78125074Z 
2026-04-26T00:37:08.781252651Z 307           provider: request.provider,
2026-04-26T00:37:08.781254601Z                                 ~~~~~~~~
2026-04-26T00:37:08.781260571Z src/modules/subscriptions/plan-upgrade-requests.service.ts:308:11 - error TS2353: Object literal may only specify known properties, and 'transactionId' does not exist in type 'Without<PaymentCreateInput, PaymentUncheckedCreateInput> & PaymentUncheckedCreateInput'.
2026-04-26T00:37:08.781262531Z 
2026-04-26T00:37:08.781264451Z 308           transactionId: `upgrade-${request.id}`,
2026-04-26T00:37:08.781266361Z               ~~~~~~~~~~~~~
2026-04-26T00:37:08.781268171Z 
2026-04-26T00:37:08.781270161Z   node_modules/.prisma/client/index.d.ts:18617:5
2026-04-26T00:37:08.781272111Z     18617     data: XOR<PaymentCreateInput, PaymentUncheckedCreateInput>
2026-04-26T00:37:08.781274121Z               ~~~~
2026-04-26T00:37:08.781276141Z     The expected type comes from property 'data' which is declared here on type '{ select?: PaymentSelect<DefaultArgs> | null | undefined; omit?: PaymentOmit<DefaultArgs> | null | undefined; include?: PaymentInclude<...> | ... 1 more ... | undefined; data: (Without<...> & PaymentUncheckedCreateInput) | (Without<...> & PaymentCreateInput); }'
2026-04-26T00:37:08.781278271Z src/modules/subscriptions/plan-upgrade-requests.service.ts:309:27 - error TS2339: Property 'newPlan' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.781280121Z 
2026-04-26T00:37:08.781282151Z 309           amount: request.newPlan.priceMonthly,
2026-04-26T00:37:08.781284071Z                               ~~~~~~~
2026-04-26T00:37:08.781286131Z src/modules/subscriptions/plan-upgrade-requests.service.ts:310:29 - error TS2339: Property 'currency' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.781287991Z 
2026-04-26T00:37:08.781289971Z 310           currency: request.currency,
2026-04-26T00:37:08.781291901Z                                 ~~~~~~~~
2026-04-26T00:37:08.781293821Z src/modules/subscriptions/plan-upgrade-requests.service.ts:322:11 - error TS2353: Object literal may only specify known properties, and 'reviewedBy' does not exist in type '(Without<PlanUpgradeRequestUpdateInput, PlanUpgradeRequestUncheckedUpdateInput> & PlanUpgradeRequestUncheckedUpdateInput) | (Without<...> & PlanUpgradeRequestUpdateInput)'.
2026-04-26T00:37:08.781295661Z 
2026-04-26T00:37:08.781297531Z 322           reviewedBy: reviewerId,
2026-04-26T00:37:08.781299531Z               ~~~~~~~~~~
2026-04-26T00:37:08.781303721Z 
2026-04-26T00:37:08.781305732Z   node_modules/.prisma/client/index.d.ts:19770:5
2026-04-26T00:37:08.781307752Z     19770     data: XOR<PlanUpgradeRequestUpdateInput, PlanUpgradeRequestUncheckedUpdateInput>
2026-04-26T00:37:08.781309741Z               ~~~~
2026-04-26T00:37:08.781313552Z     The expected type comes from property 'data' which is declared here on type '{ select?: PlanUpgradeRequestSelect<DefaultArgs> | null | undefined; omit?: PlanUpgradeRequestOmit<DefaultArgs> | null | undefined; include?: PlanUpgradeRequestInclude<...> | ... 1 more ... | undefined; data: (Without<...> & PlanUpgradeRequestUncheckedUpdateInput) | (Without<...> & PlanUpgradeRequestUpdateInput); wh...'
2026-04-26T00:37:08.781315572Z src/modules/subscriptions/plan-upgrade-requests.service.ts:338:47 - error TS2339: Property 'newPlan' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'.
2026-04-26T00:37:08.781317432Z 
2026-04-26T00:37:08.781319342Z 338         message: `Tu cambio al plan ${request.newPlan.name} ha sido aprobado.`,
2026-04-26T00:37:08.781321312Z                                                   ~~~~~~~
2026-04-26T00:37:08.781324802Z src/modules/subscriptions/plan-upgrade-requests.service.ts:341:81 - error TS2551: Property 'company' does not exist on type '{ status: PlanUpgradeStatus; id: string; createdAt: Date; updatedAt: Date; companyId: string; planId: string; notes: string | null; }'. Did you mean 'companyId'?
2026-04-26T00:37:08.781326662Z 
2026-04-26T00:37:08.781328612Z 341       await this.emailService.sendSubscriptionApproved(adminUser.email, request.company.name);
2026-04-26T00:37:08.781330562Z                                                                                     ~~~~~~~
2026-04-26T00:37:08.781339772Z src/modules/subscriptions/subscriptions.controller.ts:28:38 - error TS2339: Property 'upgradePlan' does not exist on type 'SubscriptionsService'.
2026-04-26T00:37:08.781341832Z 
2026-04-26T00:37:08.781343802Z 28     return this.subscriptionsService.upgradePlan(
2026-04-26T00:37:08.781345732Z                                         ~~~~~~~~~~~
2026-04-26T00:37:08.781348102Z src/modules/subscriptions/subscriptions.controller.ts:39:38 - error TS2339: Property 'cancelSubscription' does not exist on type 'SubscriptionsService'.
2026-04-26T00:37:08.781349962Z 
2026-04-26T00:37:08.781351872Z 39     return this.subscriptionsService.cancelSubscription(request.tenantId);
2026-04-26T00:37:08.781353842Z                                         ~~~~~~~~~~~~~~~~~~
2026-04-26T00:37:08.781355802Z src/modules/subscriptions/subscriptions.controller.ts:80:38 - error TS2551: Property 'checkPlanLimits' does not exist on type 'SubscriptionsService'. Did you mean 'checkLimit'?
2026-04-26T00:37:08.781357732Z 
2026-04-26T00:37:08.881922149Z 80     return this.subscriptionsService.checkPlanLimits(request.tenantI==> Build failed 😞
2026-04-26T00:37:08.8819441Z ==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys