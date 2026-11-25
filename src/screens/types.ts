import { BatchPrintItem, Invoice, Quotation, ReturnRecord, RouteId, Voucher } from '../types/erp';
import { useErpStore } from '../store/useErpStore';

export type ErpStore = ReturnType<typeof useErpStore>;

export interface ScreenProps {
  store: ErpStore;
  onNavigate: (r: RouteId) => void;
  onPrintInvoice?: (inv: Invoice) => void;
  onPrintVoucher?: (v: Voucher) => void;
  onPrintReturn?: (ret: ReturnRecord) => void;
  onPrintQuotation?: (qt: Quotation) => void;
  onOpenBatchPrint?: (items: BatchPrintItem[]) => void;
}
