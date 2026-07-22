from pathlib import Path

def sub(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        print("SKIP", path)
        return
    p.write_text(s.replace(old, new, 1))
    print("OK", path)

sub("tests/mandiri/storage/migrations.test.mjs",
    "assert.equal(metadata.schemaVersion, 4);",
    "assert.equal(metadata.schemaVersion, 5);")

p = "tests/mandiri/storage/database.test.mjs"
s = Path(p).read_text()
for a,b in [
("assert.equal(connection.schemaVersion, 4);","assert.equal(connection.schemaVersion, 5);"),
("assert.equal(connection.database.version, 4);","assert.equal(connection.database.version, 5);"),
("openRaw(factory, 'database-versionchange', 5, () => {})","openRaw(factory, 'database-versionchange', 6, () => {})"),
("openRaw(factory, 'database-newer-schema', 5, (database) => {","openRaw(factory, 'database-newer-schema', 6, (database) => {"),
("openRaw(factory, 'database-newer-schema', 5);","openRaw(factory, 'database-newer-schema', 6);"),
]:
    s = s.replace(a,b)
Path(p).write_text(s)

sub("assets/js/mandiri/pos/repositories/cart-repository.js",
"""export function createCartRepository(options) {
  const executor = createRepositoryExecutor(options);

  return Object.freeze({""",
"""export function createCartRepository(options) {
  const executor = createRepositoryExecutor(options);

  const repository = {""")

p="assets/js/mandiri/pos/repositories/cart-repository.js"
s=Path(p).read_text()
s=s.replace("""    },
  });
  Object.defineProperty(repository, 'listForBackup', {""",
              """    },
  };
  Object.defineProperty(repository, 'listForBackup', {"",1)
if s.endswith("""    },
  });
}
"""):
    s=s[:-len("""    },
  });
}
""")]+"""    },
  });
  return Object.freeze(repository);
}
"""
Path(p).write_text(s)

sub("assets/js/mandiri/pos/repositories/pos-repository-utils.js",
"""export function normalizeScopedCartLine(accountScope, workspaceId, input) {
  const normalized = normalizeWith(normalizeCartLine, input, { workspaceId });
  return scopedRecord(accountScope, normalized);
}""",
"""export function normalizeScopedCartLine(accountScope, workspaceId, input) {
  const normalized = normalizeWith(normalizeCartLine, input, { workspaceId });
  return Object.frefe({ accountScope, workspaceId, ...normalized });
}""")

sub("assets/js/mandiri/pos/services/cart-service.js",
"import { assertMoney, multiplyMoney } from '../../domain/money.js';",
"""import {
  addMoney,
  assertMoney,
  multiplyMoney,
  subtractMoney,
} from '../../domain/money.js';""")

sub("assets/js/mandiri/pos/services/cart-service.js",
"const lineSubtotalMinor = lineGrossMinor - lineDiscountMinor;",
"const lineSubtotalMinor = subtractMoney(lineGrossMinor, lineDiscountMinor);")

sub("assets/js/mandiri/pos/services/cart-service.js",
"const subtotalMinor = productSnapshots.reduce((sum, line) => sum + line.lineSubtotalMinor, 0);",
"const subtotalMinor = productSnapshots.reduce((sum, line) => addMoney(sum, line.lineSubtotalMinor), 0);")

sub("assets/js/mandiri/pos/services/cart-service.js",
"grandTotalMinor: subtotalMinor - command.entity.discountMinor,",
"grandTotalMinor: subtractMoney(subtotalMinor, command.entity.discountMinor),")

print("Patch selesai. Jalankan test.")
