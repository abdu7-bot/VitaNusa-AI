# Inventory System

## Objective

Mengubah gudang dari tempat menyimpan barang menjadi sistem kontrol biaya dan ketersediaan.

## Core entities

- Item
- Supplier
- Purchase Order
- Goods Receipt
- Stock Movement
- Stock Count
- Waste
- Transfer
- Adjustment
- Recipe
- Location

## Core metrics

- Inventory value
- Inventory turnover
- Days of inventory
- Stock variance
- Waste value
- Waste percentage
- Stockout frequency
- Supplier fill rate
- Purchase price variance

## Controls

1. Satu item memiliki unit dasar yang jelas.
2. Konversi unit dicatat eksplisit.
3. Semua penerimaan barang dicatat.
4. Semua pengeluaran barang harus memiliki alasan/transaksi.
5. Stock opname memiliki timestamp dan penanggung jawab.
6. Selisih stok tidak boleh langsung dihapus; investigasi terlebih dahulu.
7. Gunakan FIFO/FEFO sesuai karakter bahan.
8. Barang rusak, expired, dan waste dipisahkan dari penjualan normal.

## AI opportunities

AI dapat membantu mendeteksi:

- pembelian yang tidak biasa;
- kenaikan harga supplier;
- item dengan waste tinggi;
- pola stockout;
- selisih stok berulang;
- kebutuhan reorder berdasarkan histori dan lead time.

AI tidak boleh mengubah stok aktual tanpa audit trail dan otorisasi yang sesuai.
