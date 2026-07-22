#!/usr/bin/env python3
from pathlib import Path


def update(path_string, transform):
    path = Path(path_string)
    text = path.read_text(encoding="utf-8")
    new_text = transform(text)
    if new_text == text:
        print(f"Already applied: {path}")
        return
    path.write_text(new_text, encoding="utf-8")
    print(f"Updated: {path}")


def replace_once(text, old, new, label):
    if old in text:
        count = text.count(old)
        if count != 1:
            raise SystemExit(f"{label}: pola lama ditemukan {count} kali")
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f"{label}: pola lama maupun baru tidak ditemukan")


def patch_pos_utils(text):
    text = replace_once(
        text,
        """function stripAccountScope(record) {
  const copy = clonePlainRecord(record);
  delete copy.accountScope;
  return copy;
}
""",
        """function stripAccountScope(record) {
  const copy = clonePlainRecord(record);
  delete copy.accountScope;
  return copy;
}

function stripCartLineScope(record) {
  const copy = stripAccountScope(record);
  delete copy.workspaceId;
  return copy;
}
""",
        "pos-utils stripCartLineScope",
    )
    text = replace_once(
        text,
        """export function normalizeScopedCartLine(accountScope, workspaceId, input) {
  const normalized = normalizeWith(normalizeCartLine, input, { workspaceId });
  return scopedRecord(accountScope, normalized);
}
""",
        """export function normalizeScopedCartLine(accountScope, workspaceId, input) {
  const normalized = normalizeWith(normalizeCartLine, input, { workspaceId });
  return Object.freeze({
    accountScope,
    workspaceId,
    ...normalized,
  });
}
""",
        "pos-utils normalizeScopedCartLine",
    )
    text = replace_once(
        text,
        """export function publicCartLine(record) {
  return normalizeWith(normalizeCartLine, stripAccountScope(record), {
    workspaceId: record.workspaceId,
  });
}
""",
        """export function publicCartLine(record) {
  return normalizeWith(normalizeCartLine, stripCartLineScope(record), {
    workspaceId: record.workspaceId,
  });
}
""",
        "pos-utils publicCartLine",
    )
    return text


def patch_cart_repository(text):
    text = replace_once(
        text,
        """export function createCartRepository(options) {
  const executor = createRepositoryExecutor(options);

  return Object.freeze({
    async create(""",
        """export function createCartRepository(options) {
  const executor = createRepositoryExecutor(options);

  const repository = {
    async create(""",
        "cart-repository start",
    )
    text = replace_once(
        text,
        """    },
  });
  Object.defineProperty(repository, 'listForBackup', {""",
        """    },
  };
  Object.defineProperty(repository, 'listForBackup', {""",
        "cart-repository object close",
    )
    old_end = """    },
  });
}
"""
    new_end = """    },
  });
  return Object.freeze(repository);
}
"""
    if text.endswith(old_end):
        text = text[:-len(old_end)] + new_end
    elif not text.endswith(new_end):
        raise SystemExit("cart-repository end: pola lama maupun baru tidak ditemukan")
    return text


def patch_cart_service(text):
    text = replace_once(
        text,
        """import { assertMoney, multiplyMoney } from '../../domain/money.js';
""",
        """import {
  addMoney,
  assertMoney,
  multiplyMoney,
  subtractMoney,
} from '../../domain/money.js';
""",
        "cart-service money import",
    )
    text = replace_once(
        text,
        """  const lineSubtotalMinor = lineGrossMinor - lineDiscountMinor;
""",
        """  const lineSubtotalMinor = subtractMoney(
    lineGrossMinor,
    lineDiscountMinor,
  );
""",
        "cart-service line subtotal",
    )
    text = replace_once(
        text,
        """    const current = byProductId.get(line.productId) ?? { quantity: 0, lineDiscountMinor: 0 };
    byProductId.set(line.productId, {
      quantity: current.quantity + line.quantity,
      lineDiscountMinor: current.lineDiscountMinor + line.lineDiscountMinor,
    });
""",
        """    const current = byProductId.get(line.productId) ?? {
      quantity: 0,
      lineDiscountMinor: 0,
    };
    const quantity = assertPositiveInteger(
      current.quantity + line.quantity,
      'cartLineRequest.quantity',
    );
    const lineDiscountMinor = adMoney(
      current.lineDiscountMinor,
      line.lineDiscountMinor,
    );
    byProductId.set(line.productId, {
      quantity,
      lineDiscountMinor,
    });	""",
        "cart-service merge lines",
    )
    text = replace_once(
        text,
        """  function currentLinePriceChanged(currentCart, productsById) {
    for (const line of currentCart.lines) {
      const product = productsById.get(line.productId);
      if (product && product.sellingPriceMinor !== line.unitPriceMinor) return true;
    }
    return false;
  }
  return order.map((productId) => ({ productId, ...byProductId.get(productId) }));
}

""",
        """  return order.map((productId) => ({
    productId,
    ...byProductId.get(productId),
  }));
}

function currentLinePriceChanged(currentCart, productsById) {
  for (const line of currentCart.lines) {
    const product = productsById.get(line.productId);
    if (
      product
      && product.sellingPriceMinor !== line.unitPriceMinor
    ) {
      return true;
    }
  }
  return false;
}
""",
        "cart-service price helper scope",
    )
    text = replace_once(
        text,
        """          const subtotalMinor = productSnapshots.reduce((sum, line) => sum + line.lineSubtotalMinor, 0);
""",
        """          const subtotalMinor = productSnapshots.reduce(
            (sum, line) => addMoney(sum, line.lineSubtotalMinor),
            0,
          );
""",
        "cart-service subtotal reduce",
    )
    text = replace_once(
        text,
        """            grandTotalMinor: subtotalMinor - command.entity.discountMinor,
""",
        """            grandTotalMinor: subtractMoney(
              subtotalMinor,
              command.entity.discountMinor,
            ),
""",
        "cart-service grand total",
    )
    return text


def patch_cart_domain(text):
    return replace_once(
        text,
        """  if (input.grandTotalMinor !== input.subtotalMinor - input.discountMinor) {
""",
        """  const expectedGrandTotalMinor = subtractMoney(
    input.subtotalMinor,
    input.discountMinor,
  );
  if (input.grandTotalMinor !== expectedGrandTotalMinor) {
""",
        "cart-domain grand total validation",
    )


def patch_migrations_test(text):
    return replace_once(
        text,
        "assert.equal(metadata.schemaVersion, 4);",
        "assert.equal(metadata.schemaVersion, 5);",
        "migrations test schema version",
    )


def patch_database_test(text):
    replacements = [
        (
            "assert.equal(connection.schemaVersion, 4);",
            "assert.equal(connection.schemaVersion, 5);",
            "database test connection schema",
        ),
        (
            "assert.equal(connection.database.version, 4);",
            "assert.equal(connection.database.version, 5);",
            "database test db version",
        ),
        (
            "openRaw(factory, 'database-versionchange', 5, () => {})",
            "openRaw(factory, 'database-versionchange', 6, () => {})",
            "database test versionchange newer schema",
        ),
        (
            "openRaw(factory, 'database-newer-schema', 5, (database) => {",
            "openRaw(factory, 'database-newer-schema', 6, (database) => {",
            "database test newer schema setup",
        ),
        (
            "openRaw(factory, 'database-newer-schema', 5);",
            "openRaw(factory, 'database-newer-schema', 6);",
            "database test newer schema reopen",
        ),
    ]
    for old, new, label in replacements:
        text = replace_once(text, old, new, label)
    return text


update(
    "assets/js/mandiri/pos/repositories/pos-repository-utils.js",
    patch_pos_utils,
)
update(
    "assets/js/mandiri/pos/repositories/cart-repository.js",
    patch_cart_repository,
)
update(
    "assets/js/mandiri/pos/services/cart-service.js",
    patch_cart_service,
)
update(
    "assets/js/mandiri/pos/domain/cart.js",
    patch_cart_domain,
)
update(
    "tests/mandiri/storage/migrations.test.mjs",
    patch_migrations_test,
)
update(
    "tests/mandiri/storage/database.test.mjs",
    patch_database_test,
)

print("PR 6 blocker patch selesai. Jalankan test sebelum commit.")
