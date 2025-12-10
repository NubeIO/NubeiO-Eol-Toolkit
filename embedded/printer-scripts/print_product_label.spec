# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['C:\\qcn-disk\\zcs\\repos\\nubeiO-server-repos3\\NubeiO-Eol-Toolkit\\embedded\\printer-scripts\\print_product_label.py'],
    pathex=['C:\\qcn-disk\\zcs\\repos\\nubeiO-server-repos3\\NubeiO-Eol-Toolkit\\embedded\\printer-scripts\\py-brotherlabel'],
    binaries=[],
    datas=[],
    hiddenimports=['PIL', 'PIL._imaging', 'barcode', 'barcode.writer', 'brotherlabel', 'brother_ql', 'brother_ql.backends', 'brother_ql.backends.helpers', 'brother_ql.conversion', 'brother_ql.raster', 'usb', 'usb.core', 'usb.util', 'usb.backend', 'usb.backend.libusb1'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='print_product_label',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
