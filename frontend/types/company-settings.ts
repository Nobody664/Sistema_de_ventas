export interface CompanySettingsData {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
  currency: string;
  profileComplete?: boolean;
}
