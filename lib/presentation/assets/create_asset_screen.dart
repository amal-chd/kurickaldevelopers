import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../data/models/asset_model.dart';
import '../../providers/asset_provider.dart';
import '../../providers/user_provider.dart';

class CreateAssetScreen extends ConsumerStatefulWidget {
  final String? assetId; // null = create
  const CreateAssetScreen({super.key, this.assetId});
  @override
  ConsumerState<CreateAssetScreen> createState() => _CreateAssetScreenState();
}

class _CreateAssetScreenState extends ConsumerState<CreateAssetScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _code = TextEditingController();
  final _serial = TextEditingController();
  final _manufacturer = TextEditingController();
  final _model = TextEditingController();
  final _location = TextEditingController();
  final _supplier = TextEditingController();
  final _cost = TextEditingController();
  final _salvage = TextEditingController();
  final _life = TextEditingController(text: '5');
  final _notes = TextEditingController();

  AssetCategory _category = AssetCategory.equipment;
  AssetCondition _condition = AssetCondition.good;
  DateTime? _purchaseDate;
  DateTime? _warranty;
  bool _saving = false;
  bool _seeded = false;

  @override
  void dispose() {
    for (final c in [
      _name, _code, _serial, _manufacturer, _model, _location,
      _supplier, _cost, _salvage, _life, _notes
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _seed(AssetModel a) {
    if (_seeded) return;
    _seeded = true;
    _name.text = a.name;
    _code.text = a.code;
    _serial.text = a.serialNumber;
    _manufacturer.text = a.manufacturer;
    _model.text = a.model;
    _location.text = a.location;
    _supplier.text = a.supplier;
    _cost.text = a.purchaseCost == 0 ? '' : a.purchaseCost.toStringAsFixed(0);
    _salvage.text =
        a.salvageValue == 0 ? '' : a.salvageValue.toStringAsFixed(0);
    _life.text = a.usefulLifeYears.toStringAsFixed(0);
    _notes.text = a.notes;
    _category = a.category;
    _condition = a.condition;
    _purchaseDate = a.purchaseDate;
    _warranty = a.warrantyExpiry;
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final repo = ref.read(assetRepositoryProvider);
      final me = ref.read(currentUserProvider).value?.uid ?? '';
      final asset = AssetModel(
        id: widget.assetId ?? '',
        name: _name.text.trim(),
        code: _code.text.trim(),
        category: _category,
        serialNumber: _serial.text.trim(),
        manufacturer: _manufacturer.text.trim(),
        model: _model.text.trim(),
        condition: _condition,
        purchaseDate: _purchaseDate,
        purchaseCost: double.tryParse(_cost.text) ?? 0,
        salvageValue: double.tryParse(_salvage.text) ?? 0,
        usefulLifeYears: double.tryParse(_life.text) ?? 5,
        location: _location.text.trim(),
        supplier: _supplier.text.trim(),
        warrantyExpiry: _warranty,
        notes: _notes.text.trim(),
      );
      if (widget.assetId == null) {
        await repo.createAsset(asset, me);
      } else {
        await repo.updateAsset(widget.assetId!, asset.toRow());
      }
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Could not save: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.assetId != null;
    if (isEdit) {
      final a = ref.watch(assetProvider(widget.assetId!)).value;
      if (a != null) _seed(a);
    }

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        elevation: 0,
        title: Text(isEdit ? 'Edit Asset' : 'New Asset',
            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800)),
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
          children: [
            _field(_name, 'Name *', validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Required' : null),
            _field(_code, 'Asset tag / code'),
            _dropdown<AssetCategory>(
              'Category',
              _category,
              AssetCategory.values,
              (c) => c.label,
              (v) => setState(() => _category = v!),
            ),
            _dropdown<AssetCondition>(
              'Condition',
              _condition,
              AssetCondition.values,
              (c) => c.label,
              (v) => setState(() => _condition = v!),
            ),
            _field(_serial, 'Serial number'),
            _field(_manufacturer, 'Manufacturer'),
            _field(_model, 'Model'),
            _field(_location, 'Location'),
            _field(_supplier, 'Supplier'),
            Row(children: [
              Expanded(child: _field(_cost, 'Purchase cost (₹)',
                  keyboard: TextInputType.number)),
              const SizedBox(width: 12),
              Expanded(child: _field(_salvage, 'Salvage value (₹)',
                  keyboard: TextInputType.number)),
            ]),
            _field(_life, 'Useful life (years)',
                keyboard: TextInputType.number),
            _dateField('Purchase date', _purchaseDate,
                (d) => setState(() => _purchaseDate = d)),
            _dateField('Warranty expiry', _warranty,
                (d) => setState(() => _warranty = d)),
            _field(_notes, 'Notes', lines: 3),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    padding: const EdgeInsets.symmetric(vertical: 15)),
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Text(isEdit ? 'Save changes' : 'Create asset',
                        style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w700, color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String label,
      {TextInputType? keyboard,
      int lines = 1,
      String? Function(String?)? validator}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: c,
        keyboardType: keyboard,
        maxLines: lines,
        validator: validator,
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppTheme.divider)),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppTheme.divider)),
        ),
      ),
    );
  }

  Widget _dropdown<T>(String label, T value, List<T> items,
      String Function(T) labelOf, ValueChanged<T?> onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<T>(
        initialValue: value,
        isExpanded: true,
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppTheme.divider)),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppTheme.divider)),
        ),
        items: [
          for (final it in items)
            DropdownMenuItem(value: it, child: Text(labelOf(it))),
        ],
        onChanged: onChanged,
      ),
    );
  }

  Widget _dateField(String label, DateTime? value, ValueChanged<DateTime> onPick) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () async {
          final d = await showDatePicker(
            context: context,
            initialDate: value ?? DateTime.now(),
            firstDate: DateTime(2000),
            lastDate: DateTime(2100),
          );
          if (d != null) onPick(d);
        },
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppTheme.divider)),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppTheme.divider)),
          ),
          child: Text(
              value == null ? 'Select date' : DateFormat('d MMM yyyy').format(value),
              style: GoogleFonts.inter(
                  color: value == null ? AppTheme.textLight : AppTheme.onSurface)),
        ),
      ),
    );
  }
}
