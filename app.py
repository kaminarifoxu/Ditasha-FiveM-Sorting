from __future__ import annotations

import os
import subprocess
import threading
from collections import Counter
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import customtkinter as ctk

from ditasha_sorter.assets import find_asset_groups
from ditasha_sorter.core import scan_folder, sort_files
from ditasha_sorter.fxmanifest import generate_all_manifests
from ditasha_sorter.updater import check_for_update, download_and_install_update

APP_NAME = 'Ditasha FiveM Sorting'
VERSION = '0.2.0'

ctk.set_appearance_mode('dark')
ctk.set_default_color_theme('blue')


class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title(f'{APP_NAME} v{VERSION}')
        self.geometry('1240x780')
        self.minsize(1040, 680)

        self.source_var = tk.StringVar()
        self.output_var = tk.StringVar()
        self.mode_var = tk.StringVar(value='copy')
        self.status_var = tk.StringVar(value='Pilih folder FiveM lalu Scan.')
        self.texture_var = tk.StringVar(value='Belum ada texture')

        self.scanned = []
        self.asset_groups = []
        self.selected_group = None

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        self._build_header()
        self._build_tabs()
        self._build_footer()
        self.after(1600, self._auto_check_update)

    def _build_header(self):
        bar = ctk.CTkFrame(self, corner_radius=0, fg_color=('gray96', 'gray10'))
        bar.grid(row=0, column=0, sticky='ew')
        bar.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(bar, text='DITASHA', font=ctk.CTkFont(size=20, weight='bold')).grid(
            row=0, column=0, padx=(20, 8), pady=14, sticky='w'
        )
        ctk.CTkLabel(
            bar,
            text='FiveM Sorting',
            font=ctk.CTkFont(size=15),
            text_color=('gray40', 'gray65'),
        ).grid(row=0, column=1, pady=14, sticky='w')
        self.update_btn = ctk.CTkButton(
            bar,
            text='Check Update',
            width=110,
            height=30,
            command=lambda: self._check_update(manual=True),
        )
        self.update_btn.grid(row=0, column=2, padx=(8, 4), pady=10)
        ctk.CTkLabel(bar, text=f'v{VERSION}', text_color=('gray45', 'gray55')).grid(
            row=0, column=3, padx=(4, 20), pady=14
        )

    def _build_tabs(self):
        self.tabs = ctk.CTkTabview(self, corner_radius=10)
        self.tabs.grid(row=1, column=0, padx=14, pady=14, sticky='nsew')
        self.tabs.add('Sort')
        self.tabs.add('Preview 3D')
        self._build_sort_tab(self.tabs.tab('Sort'))
        self._build_preview_tab(self.tabs.tab('Preview 3D'))

    def _build_sort_tab(self, root):
        root.grid_columnconfigure(0, weight=1)
        root.grid_rowconfigure(2, weight=1)

        paths = ctk.CTkFrame(root, corner_radius=8)
        paths.grid(row=0, column=0, padx=8, pady=(8, 10), sticky='ew')
        paths.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(paths, text='Source').grid(row=0, column=0, padx=(14, 8), pady=(14, 7), sticky='w')
        ctk.CTkEntry(paths, textvariable=self.source_var).grid(row=0, column=1, padx=8, pady=(14, 7), sticky='ew')
        ctk.CTkButton(paths, text='Browse', width=82, command=self.pick_source).grid(row=0, column=2, padx=(8, 14), pady=(14, 7))

        ctk.CTkLabel(paths, text='Output').grid(row=1, column=0, padx=(14, 8), pady=(7, 14), sticky='w')
        ctk.CTkEntry(paths, textvariable=self.output_var).grid(row=1, column=1, padx=8, pady=(7, 14), sticky='ew')
        ctk.CTkButton(paths, text='Browse', width=82, command=self.pick_output).grid(row=1, column=2, padx=(8, 14), pady=(7, 14))

        actions = ctk.CTkFrame(root, fg_color='transparent')
        actions.grid(row=1, column=0, padx=8, pady=(0, 10), sticky='ew')
        self.scan_btn = ctk.CTkButton(actions, text='Scan', width=100, command=self.scan)
        self.scan_btn.pack(side='left')
        self.sort_btn = ctk.CTkButton(actions, text='Sort + fxmanifest', width=150, command=self.sort, state='disabled')
        self.sort_btn.pack(side='left', padx=8)
        ctk.CTkRadioButton(actions, text='Copy', variable=self.mode_var, value='copy').pack(side='left', padx=(16, 8))
        ctk.CTkRadioButton(actions, text='Move', variable=self.mode_var, value='move').pack(side='left')
        ctk.CTkButton(actions, text='Open Output', width=110, fg_color='transparent', border_width=1, command=self.open_output).pack(side='right')

        table_frame = ctk.CTkFrame(root, corner_radius=8)
        table_frame.grid(row=2, column=0, padx=8, pady=(0, 8), sticky='nsew')
        table_frame.grid_columnconfigure(0, weight=1)
        table_frame.grid_rowconfigure(0, weight=1)
        columns = ('category', 'confidence', 'file', 'reason')
        self.tree = ttk.Treeview(table_frame, columns=columns, show='headings')
        for key, title, width in [('category','Category',160),('confidence','Confidence',90),('file','File',280),('reason','Reason',480)]:
            self.tree.heading(key, text=title)
            self.tree.column(key, width=width, anchor='center' if key == 'confidence' else 'w')
        self.tree.grid(row=0, column=0, padx=(10, 0), pady=10, sticky='nsew')
        sb = ttk.Scrollbar(table_frame, orient='vertical', command=self.tree.yview)
        sb.grid(row=0, column=1, padx=(0, 10), pady=10, sticky='ns')
        self.tree.configure(yscrollcommand=sb.set)

    def _build_preview_tab(self, root):
        root.grid_columnconfigure(0, weight=0)
        root.grid_columnconfigure(1, weight=1)
        root.grid_columnconfigure(2, weight=0)
        root.grid_rowconfigure(1, weight=1)

        top = ctk.CTkFrame(root, fg_color='transparent')
        top.grid(row=0, column=0, columnspan=3, padx=8, pady=(8, 10), sticky='ew')
        ctk.CTkButton(top, text='Load Source Assets', width=135, command=self.load_asset_browser).pack(side='left')
        ctk.CTkLabel(top, text='Pilih YDD di kiri, lalu ganti YTD lewat dropdown.', text_color=('gray40','gray65')).pack(side='left', padx=12)

        left = ctk.CTkFrame(root, width=250, corner_radius=8)
        left.grid(row=1, column=0, padx=(8, 6), pady=(0, 8), sticky='ns')
        left.grid_propagate(False)
        ctk.CTkLabel(left, text='Models', font=ctk.CTkFont(weight='bold')).pack(anchor='w', padx=12, pady=(12, 6))
        self.model_list = tk.Listbox(left, borderwidth=0, highlightthickness=0)
        self.model_list.pack(fill='both', expand=True, padx=10, pady=(0, 10))
        self.model_list.bind('<<ListboxSelect>>', self._on_model_select)

        center = ctk.CTkFrame(root, corner_radius=8)
        center.grid(row=1, column=1, padx=6, pady=(0, 8), sticky='nsew')
        center.grid_columnconfigure(0, weight=1)
        center.grid_rowconfigure(0, weight=1)
        self.viewport = ctk.CTkLabel(
            center,
            text='3D VIEWPORT\n\nEngine preview YDD/YTD aktif jika backend 3D tersedia.',
            font=ctk.CTkFont(size=18, weight='bold'),
            text_color=('gray45','gray60'),
        )
        self.viewport.grid(row=0, column=0, padx=20, pady=20, sticky='nsew')

        right = ctk.CTkFrame(root, width=280, corner_radius=8)
        right.grid(row=1, column=2, padx=(6, 8), pady=(0, 8), sticky='ns')
        right.grid_propagate(False)
        ctk.CTkLabel(right, text='Texture', font=ctk.CTkFont(weight='bold')).pack(anchor='w', padx=12, pady=(12, 6))
        self.texture_menu = ctk.CTkOptionMenu(right, variable=self.texture_var, values=['Belum ada texture'], command=self._on_texture_select)
        self.texture_menu.pack(fill='x', padx=12, pady=(0, 12))
        self.asset_info = ctk.CTkTextbox(right, height=260)
        self.asset_info.pack(fill='both', expand=True, padx=12, pady=(0, 12))
        self.asset_info.insert('1.0', 'Belum ada asset dipilih.')
        self.asset_info.configure(state='disabled')

    def _build_footer(self):
        ctk.CTkLabel(self, textvariable=self.status_var, anchor='w').grid(row=2, column=0, padx=20, pady=(0, 12), sticky='ew')

    def pick_source(self):
        path = filedialog.askdirectory(title='Pilih folder FiveM')
        if path:
            self.source_var.set(path)
            if not self.output_var.get():
                self.output_var.set(str(Path(path).parent / 'Ditasha_Sorted'))

    def pick_output(self):
        path = filedialog.askdirectory(title='Pilih folder output')
        if path:
            self.output_var.set(path)

    def _validate(self):
        src = Path(self.source_var.get().strip())
        out = Path(self.output_var.get().strip()) if self.output_var.get().strip() else None
        if not src.is_dir():
            messagebox.showerror(APP_NAME, 'Source folder tidak valid.')
            return None, None
        if out is None:
            out = src.parent / 'Ditasha_Sorted'
            self.output_var.set(str(out))
        return src, out

    def scan(self):
        src, out = self._validate()
        if not src:
            return
        self.scan_btn.configure(state='disabled')
        self.sort_btn.configure(state='disabled')
        self.status_var.set('Scanning...')

        def work():
            try:
                self.scanned = scan_folder(src, out)
                self.after(0, self._render_scan)
            except Exception as exc:
                self.after(0, lambda: messagebox.showerror(APP_NAME, f'Scan gagal:\n{exc}'))
                self.after(0, lambda: self.scan_btn.configure(state='normal'))

        threading.Thread(target=work, daemon=True).start()

    def _render_scan(self):
        for item in self.tree.get_children():
            self.tree.delete(item)
        for item in self.scanned:
            self.tree.insert('', 'end', values=(item.category, item.confidence, item.filename, item.reason))
        counts = Counter(i.category for i in self.scanned)
        summary = ', '.join(f'{k}: {v}' for k, v in counts.most_common())
        self.status_var.set(f'{len(self.scanned)} file terdeteksi. {summary}' if self.scanned else 'Tidak ada file yang dikenali.')
        self.scan_btn.configure(state='normal')
        self.sort_btn.configure(state='normal' if self.scanned else 'disabled')

    def sort(self):
        src, out = self._validate()
        if not src or not self.scanned:
            return
        self.sort_btn.configure(state='disabled')
        self.status_var.set('Sorting files dan membuat fxmanifest...')

        def work():
            try:
                summary = sort_files(self.scanned, src, out, self.mode_var.get())
                manifests = generate_all_manifests(out)
                msg = (
                    f'Selesai. Copy: {summary.copied}, Move: {summary.moved}, '
                    f'Duplicate: {summary.skipped_identical}, Conflict: {summary.conflicts}.\n'
                    f'fxmanifest dibuat: {len(manifests)}'
                )
                self.after(0, lambda: self.status_var.set(msg.replace('\n', ' | ')))
                self.after(0, lambda: messagebox.showinfo(APP_NAME, msg))
            except Exception as exc:
                self.after(0, lambda: messagebox.showerror(APP_NAME, f'Sorting gagal:\n{exc}'))
            finally:
                self.after(0, lambda: self.sort_btn.configure(state='normal'))

        threading.Thread(target=work, daemon=True).start()

    def load_asset_browser(self):
        src = Path(self.source_var.get().strip())
        if not src.is_dir():
            messagebox.showwarning(APP_NAME, 'Pilih Source folder terlebih dahulu.')
            return
        self.asset_groups = find_asset_groups(src)
        self.model_list.delete(0, 'end')
        for group in self.asset_groups:
            self.model_list.insert('end', f'{group.model.name}  ({len(group.textures)} texture)')
        self.status_var.set(f'{len(self.asset_groups)} YDD model ditemukan.')

    def _on_model_select(self, _event=None):
        selection = self.model_list.curselection()
        if not selection:
            return
        self.selected_group = self.asset_groups[selection[0]]
        textures = [p.name for p in self.selected_group.textures]
        if textures:
            self.texture_menu.configure(values=textures)
            self.texture_var.set(textures[0])
        else:
            self.texture_menu.configure(values=['Tidak ada YTD pasangan'])
            self.texture_var.set('Tidak ada YTD pasangan')
        self._refresh_asset_info()
        self._render_preview_stub()

    def _on_texture_select(self, _value):
        self._refresh_asset_info()
        self._render_preview_stub()

    def _refresh_asset_info(self):
        if not self.selected_group:
            return
        selected_texture = self.texture_var.get()
        text = (
            f'Model\n{self.selected_group.model.name}\n\n'
            f'Path\n{self.selected_group.model}\n\n'
            f'Texture terpilih\n{selected_texture}\n\n'
            f'Total YTD pasangan\n{len(self.selected_group.textures)}\n'
        )
        self.asset_info.configure(state='normal')
        self.asset_info.delete('1.0', 'end')
        self.asset_info.insert('1.0', text)
        self.asset_info.configure(state='disabled')

    def _render_preview_stub(self):
        if not self.selected_group:
            return
        self.viewport.configure(
            text=(
                f'{self.selected_group.model.name}\n\n'
                f'Texture: {self.texture_var.get()}\n\n'
                '3D renderer backend akan menggunakan YDD + YTD ini.'
            )
        )

    def _auto_check_update(self):
        self._check_update(manual=False)

    def _check_update(self, manual=False):
        self.update_btn.configure(state='disabled')
        if manual:
            self.status_var.set('Checking update...')

        def work():
            try:
                info = check_for_update(VERSION)
                if info and info.available:
                    self.after(0, lambda: self._offer_update(info))
                elif manual:
                    self.after(0, lambda: messagebox.showinfo(APP_NAME, 'Kamu sudah memakai versi terbaru.'))
            except Exception as exc:
                if manual:
                    self.after(0, lambda: messagebox.showerror(APP_NAME, f'Gagal check update:\n{exc}'))
            finally:
                self.after(0, lambda: self.update_btn.configure(state='normal'))

        threading.Thread(target=work, daemon=True).start()

    def _offer_update(self, info):
        answer = messagebox.askyesno(
            APP_NAME,
            f'Versi baru {info.version} tersedia.\n\nDownload dan install sekarang?'
        )
        if not answer:
            return
        self.status_var.set(f'Downloading update {info.version}...')
        self.update_btn.configure(state='disabled')

        def work():
            try:
                download_and_install_update(info)
            except Exception as exc:
                self.after(0, lambda: messagebox.showerror(APP_NAME, f'Update gagal:\n{exc}'))
                self.after(0, lambda: self.update_btn.configure(state='normal'))

        threading.Thread(target=work, daemon=True).start()

    def open_output(self):
        path = Path(self.output_var.get().strip())
        if not path.exists():
            messagebox.showwarning(APP_NAME, 'Output folder belum ada.')
            return
        if os.name == 'nt':
            os.startfile(path)
        elif os.name == 'posix':
            subprocess.Popen(['xdg-open', str(path)])


if __name__ == '__main__':
    App().mainloop()
