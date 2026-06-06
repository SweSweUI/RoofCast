export type ConnectorStatus = 'not_configured' | 'file_import_active' | 'ready_for_setup' | 'connected' | 'sync_failed';

export interface AccountingConnector {
  id: string;
  name: string;
  platform: string;
  authType: 'oauth2' | 'api_key' | 'sftp' | 'file_import';
  status: ConnectorStatus;
  dataScope: string[];
  lastSyncedAt: string | null;
  currentSource: string;
  safeMetadata: string;
  nextAction: string;
}

const BASE: AccountingConnector[] = [
  {
    id: 'exact-online',
    name: 'Exact Online',
    platform: 'Exact',
    authType: 'oauth2',
    status: 'ready_for_setup',
    dataScope: ['GL transactions', 'sales invoices', 'customers', 'payment terms'],
    lastSyncedAt: null,
    currentSource: 'Exact-style GL exports loaded from Excel',
    safeMetadata: 'OAuth client and refresh tokens must stay server-side.',
    nextAction: 'Create Exact OAuth app and store credentials in the server vault.',
  },
  {
    id: 'snelstart',
    name: 'SnelStart',
    platform: 'SnelStart',
    authType: 'api_key',
    status: 'ready_for_setup',
    dataScope: ['FinTransactions', 'invoices', 'relations', 'ledger accounts'],
    lastSyncedAt: null,
    currentSource: 'SnelStart FinTransactions exports loaded for Peter Ummels',
    safeMetadata: 'API subscription key must stay server-side.',
    nextAction: 'Configure server-side API key and map administratie/company ids.',
  },
  {
    id: 'gilde-import',
    name: 'Gilde / Verkoopboek',
    platform: 'Gilde',
    authType: 'file_import',
    status: 'file_import_active',
    dataScope: ['sales journal exports', 'invoice rows', 'ledger mapping'],
    lastSyncedAt: null,
    currentSource: 'Altis dataset 2 workbook import',
    safeMetadata: 'No live API credentials configured; import parser is active.',
    nextAction: 'Keep file import active until a live Gilde integration is available.',
  },
  {
    id: 'excel-import',
    name: 'Excel / CSV Import',
    platform: 'Manual exports',
    authType: 'file_import',
    status: 'file_import_active',
    dataScope: ['GL exports', 'invoice registers', 'monthly summaries'],
    lastSyncedAt: null,
    currentSource: 'Current hackathon source files',
    safeMetadata: 'Raw files remain outside git; dedupe by content hash.',
    nextAction: 'Continue accepting controlled uploads as fallback for every connector.',
  },
  {
    id: 'afas',
    name: 'AFAS Profit',
    platform: 'AFAS',
    authType: 'api_key',
    status: 'not_configured',
    dataScope: ['financial mutations', 'debtors', 'sales invoices'],
    lastSyncedAt: null,
    currentSource: 'Not currently used',
    safeMetadata: 'Connector token must stay server-side.',
    nextAction: 'Add AFAS environment id and connector token in server config.',
  },
  {
    id: 'twinfield',
    name: 'Twinfield',
    platform: 'Wolters Kluwer Twinfield',
    authType: 'oauth2',
    status: 'not_configured',
    dataScope: ['transactions', 'invoices', 'customers', 'ledgers'],
    lastSyncedAt: null,
    currentSource: 'Not currently used',
    safeMetadata: 'OAuth refresh token must stay server-side.',
    nextAction: 'Create OAuth client and map office/company codes.',
  },
  {
    id: 'moneybird',
    name: 'Moneybird',
    platform: 'Moneybird',
    authType: 'oauth2',
    status: 'not_configured',
    dataScope: ['sales invoices', 'contacts', 'financial mutations'],
    lastSyncedAt: null,
    currentSource: 'Not currently used',
    safeMetadata: 'OAuth token must stay server-side.',
    nextAction: 'Create Moneybird OAuth app and map administrations.',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    platform: 'Intuit QuickBooks',
    authType: 'oauth2',
    status: 'not_configured',
    dataScope: ['invoices', 'customers', 'payments', 'accounts'],
    lastSyncedAt: null,
    currentSource: 'Not currently used',
    safeMetadata: 'OAuth token must stay server-side.',
    nextAction: 'Create Intuit app and map company realm ids.',
  },
  {
    id: 'xero',
    name: 'Xero',
    platform: 'Xero',
    authType: 'oauth2',
    status: 'not_configured',
    dataScope: ['invoices', 'contacts', 'payments', 'bank transactions'],
    lastSyncedAt: null,
    currentSource: 'Not currently used',
    safeMetadata: 'OAuth token must stay server-side.',
    nextAction: 'Create Xero OAuth app and map tenant ids.',
  },
  {
    id: 'business-central',
    name: 'Microsoft Dynamics 365 Business Central',
    platform: 'Microsoft Dynamics 365',
    authType: 'oauth2',
    status: 'not_configured',
    dataScope: ['general ledger entries', 'customers', 'sales invoices', 'payments'],
    lastSyncedAt: null,
    currentSource: 'Not currently used',
    safeMetadata: 'Azure app credentials and refresh tokens must stay server-side.',
    nextAction: 'Register Azure app, grant Business Central API permissions, and map tenant/company ids.',
  },
  {
    id: 'netsuite',
    name: 'Oracle NetSuite',
    platform: 'NetSuite',
    authType: 'oauth2',
    status: 'not_configured',
    dataScope: ['transactions', 'invoices', 'customers', 'accounts', 'payments'],
    lastSyncedAt: null,
    currentSource: 'Not currently used',
    safeMetadata: 'OAuth client credentials and tokens must stay server-side.',
    nextAction: 'Create NetSuite integration record and map subsidiary/company ids.',
  },
  {
    id: 'sap-business-one',
    name: 'SAP Business One',
    platform: 'SAP',
    authType: 'api_key',
    status: 'not_configured',
    dataScope: ['journal entries', 'business partners', 'AR invoices', 'incoming payments'],
    lastSyncedAt: null,
    currentSource: 'Not currently used',
    safeMetadata: 'Service Layer credentials must stay server-side.',
    nextAction: 'Configure Service Layer endpoint, company database, and server-side credentials.',
  },
  {
    id: 'sage',
    name: 'Sage Accounting',
    platform: 'Sage',
    authType: 'oauth2',
    status: 'not_configured',
    dataScope: ['sales invoices', 'contacts', 'ledger accounts', 'payments'],
    lastSyncedAt: null,
    currentSource: 'Not currently used',
    safeMetadata: 'OAuth client credentials and refresh tokens must stay server-side.',
    nextAction: 'Create Sage developer app and map company ids.',
  },
  {
    id: 'visma',
    name: 'Visma eAccounting',
    platform: 'Visma',
    authType: 'oauth2',
    status: 'not_configured',
    dataScope: ['vouchers', 'invoices', 'customers', 'payments'],
    lastSyncedAt: null,
    currentSource: 'Not currently used',
    safeMetadata: 'OAuth credentials and tokens must stay server-side.',
    nextAction: 'Create Visma app and map tenant/company ids.',
  },
  {
    id: 'yuki',
    name: 'Yuki',
    platform: 'Yuki',
    authType: 'api_key',
    status: 'not_configured',
    dataScope: ['administrations', 'transactions', 'sales invoices', 'relations'],
    lastSyncedAt: null,
    currentSource: 'Not currently used',
    safeMetadata: 'API key must stay server-side.',
    nextAction: 'Configure Yuki API key and map administration ids.',
  },
];

export function connectorsFromSources(sourceFiles: any[]): AccountingConnector[] {
  const sourceBlob = JSON.stringify(sourceFiles).toLowerCase();
  const loadedAt = new Date().toISOString();
  return BASE.map((connector) => {
    const hasData =
      connector.id === 'exact-online'
        ? sourceBlob.includes('exact-style')
        : connector.id === 'snelstart'
          ? sourceBlob.includes('snelstart')
          : connector.id === 'gilde-import'
            ? sourceBlob.includes('gilde')
            : connector.id === 'excel-import'
              ? sourceFiles.length > 0
              : false;
    if (!hasData) return connector;
    return {
      ...connector,
      status: connector.authType === 'file_import' ? 'file_import_active' : 'file_import_active',
      lastSyncedAt: loadedAt,
    };
  });
}
