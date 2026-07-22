from pathlib import Path

def sub(path, old, new):
    p = Path(path)
    s = p.read_text(encoding="utf-8")
    if old in s:
        if s.count(old) != 1:
            raise SystemExit(f"{path}: pola ditemukan lebih dari sekali")
        p.write_text(s.replace(old, new, 1), encoding="utf-8")
        print("OK", path)
    elif new in s:
        print("SKIP", path)
    else:
        raise SystemExit(f"{path}: pola tidak ditemukan")

sub("assets/js/mandiri/pos/repositories/pos-repository-utils.js",
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
""")

sub("assets/js/mandiri/pos/repositories/pos-repository-utils.js",
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
""")

sub("assets/js/mandiri/pos/services/cart-service.js",
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
""")

sub("assets/js/mandiri/pos/services/cart-service.js",
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
    const lineDiscountMinor = addMoney(
      current.lineDiscountMinor,
      line.lineDiscountMinor,
    );
    byProductId.set(line.productId, {
      quantity,
      lineDiscountMinor,
    });
""")

sub("assets/js/mandiri/pos/domain/cart.js",
"""  if (input.grandTotalMinor !== input.subtotalMinor - input.discountMinor) {
""",
"""  const expectedGrandTotalMinor = subtractMoney(
    input.subtotalMinor,
    input.discountMinor,
  );
  if (input.grandTotalMinor !== expectedGrandTotalMinor) {
""")

print("Patch bagian 2 selesai.")
