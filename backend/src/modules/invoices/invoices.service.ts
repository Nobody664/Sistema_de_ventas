import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateInvoiceTemplateDto, UpdateInvoiceTemplateDto } from './dto/invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findTemplates(companyId?: string, includeGlobal = true) {
    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (includeGlobal) {
      where.OR = [
        { companyId },
        { isGlobal: true },
      ];
    } else {
      where.companyId = companyId;
    }

    return this.prisma.invoiceTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findTemplateById(id: string, companyId?: string) {
    const template = await this.prisma.invoiceTemplate.findFirst({
      where: {
        id,
        OR: [
          { companyId },
          { isGlobal: true },
        ],
      },
    });

    if (!template) {
      throw new NotFoundException('Plantilla no encontrada');
    }

    return template;
  }

  async create(companyId: string, isGlobal: boolean, input: CreateInvoiceTemplateDto) {
    if (!isGlobal && !companyId) {
      throw new ForbiddenException('Debe especificar una empresa');
    }

    const data: any = {
      name: input.name || 'Plantilla',
      isGlobal,
      type: input.type || 'BOLETA',
      headerText: input.headerText,
      logoUrl: input.logoUrl,
      companyRuc: input.companyRuc,
      companyAddress: input.companyAddress,
      companyPhone: input.companyPhone,
      showLogo: input.showLogo ?? true,
      showCompany: input.showCompany ?? true,
      showCustomer: input.showCustomer ?? true,
      showEmployee: input.showEmployee ?? false,
      showItems: input.showItems ?? true,
      showSubtotal: input.showSubtotal ?? true,
      showTax: input.showTax ?? true,
      showDiscount: input.showDiscount ?? true,
      showSaleNumber: input.showSaleNumber ?? true,
      showSaleDate: input.showSaleDate ?? true,
      showSaleTime: input.showSaleTime ?? false,
      showPaymentMethod: input.showPaymentMethod ?? true,
      footerText: input.footerText,
      taxPercentage: input.taxPercentage || 18,
      customFields: input.customFields,
      fontFamily: input.fontFamily || 'Arial',
      fontSize: input.fontSize || 12,
      paperSize: input.paperSize || 'A4',
    };

    if (isGlobal) {
      data.companyId = null;
    } else {
      data.companyId = companyId;
    }

    if (input.isDefault) {
      await this.prisma.invoiceTemplate.updateMany({
        where: { companyId: isGlobal ? null : companyId },
        data: { isDefault: false },
      });
    }

    return this.prisma.invoiceTemplate.create({
      data,
    });
  }

  async update(id: string, companyId: string, input: UpdateInvoiceTemplateDto) {
    const template = await this.findTemplateById(id, companyId);

    if (input.isDefault) {
      await this.prisma.invoiceTemplate.updateMany({
        where: { 
          companyId: template.companyId,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.type !== undefined) data.type = input.type;
    if (input.headerText !== undefined) data.headerText = input.headerText;
    if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
    if (input.companyRuc !== undefined) data.companyRuc = input.companyRuc;
    if (input.companyAddress !== undefined) data.companyAddress = input.companyAddress;
    if (input.companyPhone !== undefined) data.companyPhone = input.companyPhone;
    if (input.showLogo !== undefined) data.showLogo = input.showLogo;
    if (input.showCompany !== undefined) data.showCompany = input.showCompany;
    if (input.showCustomer !== undefined) data.showCustomer = input.showCustomer;
    if (input.showEmployee !== undefined) data.showEmployee = input.showEmployee;
    if (input.showItems !== undefined) data.showItems = input.showItems;
    if (input.showSubtotal !== undefined) data.showSubtotal = input.showSubtotal;
    if (input.showTax !== undefined) data.showTax = input.showTax;
    if (input.showDiscount !== undefined) data.showDiscount = input.showDiscount;
    if (input.showSaleNumber !== undefined) data.showSaleNumber = input.showSaleNumber;
    if (input.showSaleDate !== undefined) data.showSaleDate = input.showSaleDate;
    if (input.showSaleTime !== undefined) data.showSaleTime = input.showSaleTime;
    if (input.showPaymentMethod !== undefined) data.showPaymentMethod = input.showPaymentMethod;
    if (input.footerText !== undefined) data.footerText = input.footerText;
    if (input.taxPercentage !== undefined) data.taxPercentage = input.taxPercentage;
    if (input.customFields !== undefined) data.customFields = input.customFields;
    if (input.fontFamily !== undefined) data.fontFamily = input.fontFamily;
    if (input.fontSize !== undefined) data.fontSize = input.fontSize;
    if (input.paperSize !== undefined) data.paperSize = input.paperSize;
    if (input.isDefault !== undefined) data.isDefault = input.isDefault;

    return this.prisma.invoiceTemplate.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, companyId: string) {
    const template = await this.findTemplateById(id, companyId);

    return this.prisma.invoiceTemplate.delete({
      where: { id },
    });
  }

  async getDefaultTemplate(companyId?: string) {
    const template = await this.prisma.invoiceTemplate.findFirst({
      where: {
        OR: [
          { companyId, isDefault: true },
          { companyId: null, isGlobal: true, isDefault: true },
          { companyId },
          { isGlobal: true },
        ],
        isActive: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { isGlobal: 'asc' },
      ],
    });

    if (!template) {
      return this.getDefaultTemplateStructure();
    }

    return template;
  }

  private getDefaultTemplateStructure() {
    return {
      id: 'default',
      name: 'Boleta Standard',
      description: 'Plantilla estándar de boleta',
      type: 'BOLETA',
      headerText: null,
      logoUrl: null,
      companyRuc: null,
      companyAddress: null,
      companyPhone: null,
      showLogo: true,
      showCompany: true,
      showCustomer: true,
      showEmployee: false,
      showItems: true,
      showSubtotal: true,
      showTax: true,
      showDiscount: true,
      showSaleNumber: true,
      showSaleDate: true,
      showSaleTime: false,
      showPaymentMethod: true,
      footerText: 'Gracias por su preferencia',
      taxPercentage: 18,
      customFields: null,
      fontFamily: 'Arial',
      fontSize: 12,
      paperSize: 'A4',
      isActive: true,
      isDefault: true,
    };
  }

  async generateInvoiceHtml(saleId: string, companyId: string, templateId?: string) {
    const template = templateId 
      ? await this.findTemplateById(templateId, companyId)
      : await this.getDefaultTemplate(companyId);

    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        company: true,
        customer: true,
        employee: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    const html = this.buildInvoiceHtml(sale, template, companyId);
    return { html, template };
  }

  private buildInvoiceHtml(sale: any, template: any, companyId: string) {
    const isThermal = template.paperSize === 'thermal';
    const docType = template.type || 'BOLETA';
    
    const companyRuc = template.companyRuc || sale.company?.taxId || '';
    const companyAddress = template.companyAddress || sale.company?.address || '';
    const companyPhone = template.companyPhone || sale.company?.phone || '';
    const companyName = sale.company?.name || 'Empresa';
    
    const items = sale.items.map((item: any) => `
      <tr>
        <td style="padding: 4px 8px;">${item.product?.name || 'Producto'}</td>
        <td style="padding: 4px 8px; text-align:center">${item.quantity}</td>
        <td style="padding: 4px 8px; text-align:right">${Number(item.unitPrice).toFixed(2)}</td>
        <td style="padding: 4px 8px; text-align:right">${Number(item.totalAmount).toFixed(2)}</td>
      </tr>
    `).join('');

    const saleDate = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }) : '';
    
    const saleTime = sale.createdAt ? new Date(sale.createdAt).toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
    }) : '';

    const customerName = sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName || ''}`.trim() : 'Cliente General';
    const customerDoc = sale.customer?.documentValue ? `${sale.customer.documentType || 'DNI'} ${sale.customer.documentValue}` : '';
    
    const paymentMethodLabels: Record<string, string> = {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
      YAPE: 'Yape',
      PLIN: 'Plin',
    };
    const paymentMethod = paymentMethodLabels[sale.paymentMethod] || sale.paymentMethod || 'Efectivo';

    const taxPercent = template.taxPercentage || 18;

    if (isThermal) {
      return this.buildThermalTicket(docType, companyName, companyRuc, companyAddress, companyPhone, sale, customerName, customerDoc, saleDate, saleTime, paymentMethod, items, taxPercent, template);
    }

    return this.buildStandardInvoice(docType, companyName, companyRuc, companyAddress, companyPhone, sale, customerName, customerDoc, saleDate, saleTime, paymentMethod, items, taxPercent, template);
  }

  private buildThermalTicket(
    docType: string,
    companyName: string,
    companyRuc: string,
    companyAddress: string,
    companyPhone: string,
    sale: any,
    customerName: string,
    customerDoc: string,
    saleDate: string,
    saleTime: string,
    paymentMethod: string,
    items: string,
    taxPercent: number,
    template: any
  ) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${docType} ${sale.saleNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Courier New', monospace; 
      font-size: 10px; 
      width: 58mm; 
      margin: 0 auto; 
      padding: 5px;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .uppercase { text-transform: uppercase; }
    .border-top { border-top: 1px dashed #333; margin: 8px 0; }
    .border-bottom { border-bottom: 1px dashed #333; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    .item-row td { padding: 2px 0; }
    .footer { text-align: center; margin-top: 10px; font-size: 9px; }
    @media print {
      body { width: 58mm; margin: 0; }
      @page { margin: 0; size: 58mm auto; }
    }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="bold uppercase">${companyName}</div>
    ${companyRuc ? `<div>RUC: ${companyRuc}</div>` : ''}
    ${companyAddress ? `<div>${companyAddress}</div>` : ''}
    ${companyPhone ? `<div>Tel: ${companyPhone}</div>` : ''}
    
    <div class="border-top"></div>
    <div class="bold uppercase">${docType} DE VENTA</div>
    <div>N° ${sale.saleNumber}</div>
    <div class="border-top"></div>
  </div>

  <table>
    <tr><td colspan="4">Fecha: ${saleDate}</td></tr>
    ${template.showSaleTime ? `<tr><td colspan="4">Hora: ${saleTime}</td></tr>` : ''}
    ${template.showCustomer && customerName ? `<tr><td colspan="4">Cliente: ${customerName}</td></tr>` : ''}
    ${customerDoc ? `<tr><td colspan="4">${customerDoc}</td></tr>` : ''}
  </table>

  <div class="border-top"></div>
  
  <table>
    <thead>
      <tr>
        <th style="text-align:left">Producto</th>
        <th style="text-align:center">Cant</th>
        <th style="text-align:right">P.Unit</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody class="item-row">
      ${items}
    </tbody>
  </table>

  <div class="border-top"></div>

  <table>
    ${template.showSubtotal ? `<tr><td>Subtotal:</td><td class="text-right">S/ ${Number(sale.subtotal).toFixed(2)}</td></tr>` : ''}
    ${template.showTax ? `<tr><td>IGV (${taxPercent}%):</td><td class="text-right">S/ ${Number(sale.taxAmount).toFixed(2)}</td></tr>` : ''}
    ${template.showDiscount && Number(sale.discountAmount) > 0 ? `<tr><td>Descuento:</td><td class="text-right">-S/ ${Number(sale.discountAmount).toFixed(2)}</td></tr>` : ''}
    <tr class="bold">
      <td>TOTAL:</td>
      <td class="text-right">S/ ${Number(sale.totalAmount).toFixed(2)}</td>
    </tr>
  </table>

  ${template.showPaymentMethod ? `<div class="text-center" style="margin-top:8px;">Pago: ${paymentMethod}</div>` : ''}

  <div class="footer">
    <div class="border-top"></div>
    <p>${template.footerText || 'Gracias por su preferencia'}</p>
    <p class="uppercase">${docType} ${sale.saleNumber}</p>
  </div>
</body>
</html>
    `.trim();
  }

  private buildStandardInvoice(
    docType: string,
    companyName: string,
    companyRuc: string,
    companyAddress: string,
    companyPhone: string,
    sale: any,
    customerName: string,
    customerDoc: string,
    saleDate: string,
    saleTime: string,
    paymentMethod: string,
    items: string,
    taxPercent: number,
    template: any
  ) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${docType} ${sale.saleNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: ${template.fontFamily || 'Arial'}; 
      font-size: ${template.fontSize || 12}px; 
      margin: 20px;
      color: #333;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }
    .header {
      text-align: center;
      padding: 20px 0;
      border-bottom: 2px solid #1a1a2e;
      margin-bottom: 20px;
    }
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a2e;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .company-info {
      font-size: 11px;
      color: #666;
      margin-top: 8px;
    }
    .doc-type {
      font-size: 18px;
      font-weight: bold;
      color: #1a1a2e;
      margin: 15px 0 5px;
      text-transform: uppercase;
    }
    .sale-number {
      font-size: 14px;
      color: #444;
    }
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .info-box {
      background: #f8f9fa;
      padding: 12px 15px;
      border-radius: 6px;
      flex: 1;
      margin: 0 5px;
    }
    .info-box:first-child { margin-left: 0; }
    .info-box:last-child { margin-right: 0; }
    .info-label {
      font-size: 10px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 13px;
      color: #333;
      font-weight: 500;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    thead th {
      background: #1a1a2e;
      color: white;
      padding: 10px 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    tbody td {
      padding: 10px 8px;
      border-bottom: 1px solid #eee;
    }
    tbody tr:hover { background: #f8f9fa; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .totals-section {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
    .totals-table {
      width: 280px;
    }
    .totals-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #eee;
    }
    .totals-table .label {
      color: #666;
    }
    .totals-table .value {
      text-align: right;
      font-weight: 500;
    }
    .grand-total {
      background: #1a1a2e !important;
      color: white !important;
      font-size: 16px;
      font-weight: bold;
    }
    .grand-total td {
      border-bottom: none !important;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    .footer-text {
      font-size: 12px;
      color: #888;
    }
    .payment-info {
      background: #f0f7ff;
      padding: 10px 15px;
      border-radius: 6px;
      margin-top: 20px;
      display: inline-block;
    }
    .payment-label {
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
    }
    .payment-value {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a2e;
    }
    @media print {
      body { margin: 0; }
      .invoice-container { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      ${template.showLogo && template.logoUrl ? `<img src="${template.logoUrl}" alt="Logo" style="max-height: 60px; margin-bottom: 10px;">` : ''}
      ${template.showCompany ? `
        <div class="company-name">${companyName}</div>
        <div class="company-info">
          ${companyRuc ? `<span>RUC: ${companyRuc}</span>` : ''}
          ${companyRuc && companyAddress ? '<span> | </span>' : ''}
          ${companyAddress ? `<span>${companyAddress}</span>` : ''}
          ${companyPhone ? `<span> | Tel: ${companyPhone}</span>` : ''}
        </div>
      ` : ''}
      <div class="doc-type">${docType} DE VENTA</div>
      <div class="sale-number">N° ${sale.saleNumber}</div>
    </div>

    ${template.showCustomer ? `
    <div class="info-section">
      <div class="info-box">
        <div class="info-label">Fecha</div>
        <div class="info-value">${saleDate}${template.showSaleTime ? ` ${saleTime}` : ''}</div>
      </div>
      <div class="info-box">
        <div class="info-label">Cliente</div>
        <div class="info-value">${customerName}</div>
      </div>
      <div class="info-box">
        <div class="info-label">Documento</div>
        <div class="info-value">${customerDoc || 'Sin documento'}</div>
      </div>
    </div>
    ` : ''}

    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th class="text-center">Cant.</th>
          <th class="text-right">P. Unit</th>
          <th class="text-right">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${items}
      </tbody>
    </table>

    <div class="totals-section">
      <table class="totals-table">
        ${template.showSubtotal ? `
        <tr>
          <td class="label">Subtotal</td>
          <td class="value">S/ ${Number(sale.subtotal).toFixed(2)}</td>
        </tr>
        ` : ''}
        ${template.showTax ? `
        <tr>
          <td class="label">IGV (${taxPercent}%)</td>
          <td class="value">S/ ${Number(sale.taxAmount).toFixed(2)}</td>
        </tr>
        ` : ''}
        ${template.showDiscount && Number(sale.discountAmount) > 0 ? `
        <tr>
          <td class="label">Descuento</td>
          <td class="value" style="color: #dc2626;">-S/ ${Number(sale.discountAmount).toFixed(2)}</td>
        </tr>
        ` : ''}
        <tr class="grand-total">
          <td>TOTAL A PAGAR</td>
          <td>S/ ${Number(sale.totalAmount).toFixed(2)}</td>
        </tr>
      </table>
    </div>

    ${template.showPaymentMethod ? `
    <div class="payment-info">
      <div class="payment-label">Forma de Pago</div>
      <div class="payment-value">${paymentMethod}</div>
    </div>
    ` : ''}

    <div class="footer">
      <p class="footer-text">${template.footerText || 'Gracias por su preferencia'}</p>
      <p class="footer-text" style="margin-top: 5px; font-size: 10px;">
        ${docType} N° ${sale.saleNumber} - ${companyName}
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}
