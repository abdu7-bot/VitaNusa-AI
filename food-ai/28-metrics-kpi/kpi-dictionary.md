# F&B KPI Dictionary

Semua KPI harus memiliki definisi, formula, grain, periode, sumber data, dan owner.

| KPI | Formula inti | Catatan |
|---|---|---|
| Net Sales | Gross Sales − discounts/returns sesuai definisi | Nyatakan perlakuan pajak |
| Average Check | Net Sales ÷ transactions | Periode harus sama |
| Food Cost % | Food COGS ÷ food sales × 100 | Definisi COGS harus konsisten |
| Beverage Cost % | Beverage COGS ÷ beverage sales × 100 | Pisahkan kategori |
| Labor Cost % | Labor Cost ÷ Net Sales × 100 | Nyatakan biaya yang termasuk |
| Prime Cost % | (COGS + Labor Cost) ÷ Net Sales × 100 | Definisi labor konsisten |
| Gross Margin % | Gross Margin ÷ Net Sales × 100 | Gross Margin = Sales − COGS |
| Waste % | Waste Value ÷ relevant usage/value × 100 | Pilih denominator dan konsisten |
| Inventory Turnover | COGS ÷ average inventory | Periode wajib dicatat |
| Stock Variance % | absolute variance ÷ expected usage × 100 | Investigasi penyebab |
| Labor Productivity | Sales ÷ labor hours | Bandingkan konteks yang sama |
| Ticket Time | timestamp ready − timestamp order | Gunakan distribusi, bukan hanya rata-rata |
| Repeat Purchase Rate | repeat customers ÷ customers × 100 | Definisi repeat window harus jelas |
| Break-even Sales | Fixed Costs ÷ contribution margin ratio | Asumsi margin wajib disimpan |

## KPI governance

KPI yang namanya sama tidak otomatis memiliki definisi yang sama. Food AI harus menyimpan definisi lokal sebelum membandingkan angka antar outlet atau periode.

## Anti-misleading rules

- Jangan membandingkan KPI dengan periode berbeda tanpa penyesuaian.
- Jangan menyebut kenaikan omzet sebagai perbaikan bisnis tanpa melihat margin dan cash flow.
- Jangan menyimpulkan penyebab hanya dari korelasi.
- Jangan menyembunyikan denominator.
