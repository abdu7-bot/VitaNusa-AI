import { MANDIRI_STORE_NAMES } from '../../storage/schema.js';
import { storageError } from '../../storage/storage-errors.js';
import {
  createRepositoryExecutor, keyRangeBound, keyRangeOnly,
  normalizeAccountScope, normalizeEntityIdentifier, normalizeWorkspaceScope,
} from '../../repositories/repository-utils.js';
import { normalizePayment } from '../domain/payment.js';
import { normalizeReceipt } from '../domain/receipt.js';
import { normalizeSale, normalizeSaleLine, validateFinalSale } from '../domain/sale.js';
import { clonePlainRecord, normalizeWith } from '../../repositories/repository-utils.js';

const SALES = MANDIRI_STORE_NAMES.SALES;
const LINES = MANDIRI_STORE_NAMES.SALE_LINES;
const PAYMENTS = MANDIRI_STORE_NAMES.PAYMENTS;
const RECEIPTS = MANDIRI_STORE_NAMES.RECEIPTS;
const STORES = Object.freeze([SALES, LINES, PAYMENTS, RECEIPTS]);

function scoped(accountScope, record) {
  return Object.freeze({ accountScope, ...record });
}

function publicRecord(normalizer, record) {
  const copy = clonePlainRecord(record);
  delete copy.accountScope;
  return normalizeWith(normalizer, copy, { workspaceId: record.workspaceId });
}

function scopedLine(accountScope, workspaceId, line) {
  return Object.freeze({ accountScope, workspaceId, ...normalizeSaleLine(line) });
}

function publicLine(record) {
  const copy = clonePlainRecord(record);
  delete copy.accountScope;
  delete copy.workspaceId;
  return normalizeSaleLine(copy);
}

export function createSaleRepository(options) {
  const executor = createRepositoryExecutor(options);
  const repository = {
    async appendFinal(accountValue, workspaceValue, saleInput, lineInputs, paymentInput, receiptInput) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const { sale, lines } = validateFinalSale(saleInput, lineInputs);
      const normalizedSale = normalizeWith(normalizeSale, sale, { workspaceId });
      const payment = normalizeWith(normalizePayment, paymentInput, { workspaceId });
      const receipt = normalizeWith(normalizeReceipt, receiptInput, { workspaceId });
      if (
        payment.saleId !== sale.saleId || payment.paymentId !== sale.paymentId
        || receipt.saleId !== sale.saleId || receipt.paymentId !== payment.paymentId
        || receipt.receiptId !== sale.receiptId
      ) throw storageError('data_invalid');
      return executor.run(STORES, 'readwrite', async (transaction) => {
        await transaction.request(transaction.objectStore(SALES).add(scoped(accountScope, normalizedSale)));
        for (const line of lines) {
          await transaction.request(transaction.objectStore(LINES).add(scopedLine(accountScope, workspaceId, line)));
        }
        await transaction.request(transaction.objectStore(PAYMENTS).add(scoped(accountScope, payment)));
        await transaction.request(transaction.objectStore(RECEIPTS).add(scoped(accountScope, receipt)));
        return Object.freeze({
          sale: normalizedSale, lines, payment, receipt,
        });
      });
    },

    async get(accountValue, workspaceValue, saleValue) {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      const saleId = normalizeEntityIdentifier(saleValue, 'sale');
      return executor.run(STORES, 'readonly', async (transaction) => {
        const saleRecord = await transaction.request(transaction.objectStore(SALES).get([accountScope, workspaceId, saleId]));
        if (!saleRecord) return null;
        const [lineRecords, paymentRecords, receiptRecords] = await Promise.all([
          transaction.request(transaction.objectStore(LINES).index('bySale').getAll(keyRangeOnly(transaction, [accountScope, workspaceId, saleId]))),
          transaction.request(transaction.objectStore(PAYMENTS).index('bySale').getAll(keyRangeOnly(transaction, [accountScope, workspaceId, saleId]))),
          transaction.request(transaction.objectStore(RECEIPTS).index('bySale').getAll(keyRangeOnly(transaction, [accountScope, workspaceId, saleId]))),
        ]);
        if (paymentRecords.length !== 1 || receiptRecords.length !== 1) throw storageError('data_invalid');
        return Object.freeze({
          sale: publicRecord(normalizeSale, saleRecord),
          lines: Object.freeze(lineRecords.map(publicLine).sort((a, b) => a.lineNo - b.lineNo)),
          payment: publicRecord(normalizePayment, paymentRecords[0]),
          receipt: publicRecord(normalizeReceipt, receiptRecords[0]),
        });
      });
    },
  };

  Object.defineProperty(repository, 'listForBackup', {
    enumerable: false,
    value: async (accountValue, workspaceValue) => {
      const accountScope = normalizeAccountScope(accountValue);
      const workspaceId = normalizeWorkspaceScope(workspaceValue);
      return executor.run(STORES, 'readonly', async (transaction) => {
        const [sales, saleLines, payments, receipts] = await Promise.all([
          transaction.request(transaction.objectStore(SALES).index('byWorkspaceFinalizedAt').getAll(keyRangeBound(
            transaction, [accountScope, workspaceId, ''], [accountScope, workspaceId, '\uffff'],
          ))),
          transaction.request(transaction.objectStore(LINES).index('bySale').getAll(keyRangeBound(
            transaction, [accountScope, workspaceId, ''], [accountScope, workspaceId, '\uffff'],
          ))),
          transaction.request(transaction.objectStore(PAYMENTS).getAll()),
          transaction.request(transaction.objectStore(RECEIPTS).getAll()),
        ]);
        const inScope = (record) => record.accountScope === accountScope && record.workspaceId === workspaceId;
        return Object.freeze({
          sales: Object.freeze(sales.map((record) => publicRecord(normalizeSale, record))),
          saleLines: Object.freeze(saleLines.map(publicLine)),
          payments: Object.freeze(payments.filter(inScope).map((record) => publicRecord(normalizePayment, record))),
          receipts: Object.freeze(receipts.filter(inScope).map((record) => publicRecord(normalizeReceipt, record))),
        });
      });
    },
  });
  return Object.freeze(repository);
}
