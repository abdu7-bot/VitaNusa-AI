# Standard Recipe Schema

Tujuan: setiap menu harus dapat diproduksi dengan hasil yang konsisten dan dihitung biayanya.

```yaml
recipe_id:
recipe_name:
version:
status: draft | active | retired
category:
serving_size:
serving_unit:
ingredients:
  - ingredient_id:
    name:
    quantity:
    unit:
    yield_percent:
    cost_per_unit:
    extended_cost:
preparation_steps: []
cooking_method:
cooking_time:
cooking_temperature:
expected_yield:
waste_target:
portion_control:
packaging:
allergens: []
halal_status:
equipment: []
quality_critical_points: []
photo_reference:
created_at:
reviewed_at:
approved_by:
```

## Recipe governance

- Jangan mengubah recipe aktif tanpa versioning.
- Setiap perubahan bahan, gramasi, yield, proses, atau supplier yang berdampak pada biaya harus dapat ditelusuri.
- Standard recipe harus terhubung dengan costing dan SOP produksi.
- Foto plating dan ukuran porsi dapat digunakan sebagai referensi visual.
