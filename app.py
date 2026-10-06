from __future__ import annotations

import os
import subprocess
import threading
from collections import Counter
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import customtkinter as ctk

from ditasha_sorter.core import scan_folder, sort_files
from ditasha_sorter.fxmanifest import generate_all_manifests

APP_NAME = 'Ditasha FiveM Sorting'
VERSION = '0.1.0'

ctk.set_appearance_mode('dark')
ctk.set_default_color_theme('blue')


class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title(f'{APP_NAME} v{VERSION}')
        self.geometry('1050x700')
        self.minsize(900, 620)
        self.source_var = tk.StringVar()
        self.output_var = tk.StringVar()
        self.mode_var = tk.StringVar(value='copy')
        self.status_var = tk.StringVar(value='Pilih folder yang berisi file FiveM, lalu tekan Scan.')
        self.scanned = []
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)
        self._build_header(); self._build_paths(); self._build_results(); self._build_footer()

    def _build_header(self):
        frame = ctk.CTkFrame(self, corner_radius=0); frame.grid(row=0, column=0, sticky='ew'); frame.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(frame, text='Ditasha FiveM Sorting', font=ctk.CTkFont(size=24, weight='bold')).grid(row=0, column=0, padx=22, pady=(18, 0), sticky='w')
        ctk.CTkLabel(frame, text='Sort ped, hair, dan clothing menjadi resource FiveM siap pakai.', text_color=('gray35', 'gray70')).grid(row=1, column=0, padx=22, pady=(2, 16), sticky='w')

    def _build_paths(self):
        frame = ctk.CTkFrame(self); frame.grid(row=1, column=0, padx=18, pady=16, sticky='ew'); frame.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(frame, text='Source').grid(row=0, column=0, padx=(16, 8), pady=(16, 8), sticky='w')
        ctk.CTkEntry(frame, textvariable=self.source_var).grid(row=0, column=1, padx=8, pady=(16, 8), sticky='ew')
        ctk.CTkButton(frame, text='Browse', width=90, command=self.pick_source).grid(row=0, column=2, padx=(8, 16), pady=(16, 8))
        ctk.CTkLabel(frame, text='Output').grid(row=1, column=0, padx=(16, 8), pady=(8, 16), sticky='w')
        ctk.CTkEntry(frame, textvariable=self.output_var).grid(row=1, column=1, padx=8, pady=(8, 16), sticky='ew')
        ctk.CTkButton(frame, text='Browse', width=90, command=self.pick_output).grid(row=1, column=2, padx=(8, 16), pady=(8, 16))
        mf = ctk.CTkFrame(frame, fg_color='transparent'); mf.grid(row=2, column=1, columnspan=2, padx=8, pady=(0, 14), sticky='w')
        ctk.CTkRadioButton(mf, text='Copy (aman)', variable=self.mode_var, value='copy').pack(side='left', padx=(0, 16))
        ctk.CTkRadioButton(mf, text='Move', variable=self.mode_var, value='move').pack(side='left')

    def _build_results(self):
        frame = ctk.CTkFrame(self); frame.grid(row=2, column=0, padx=18, pady=(0, 12), sticky='nsew'); frame.grid_columnconfigure(0, weight=1); frame.grid_rowconfigure(1, weight=1)
        actions = ctk.CTkFrame(frame, fg_color='transparent'); actions.grid(row=0, column=0, padx=14, pady=12, sticky='ew')
        self.scan_btn = ctk.CTkButton(actions, text='Scan Files', command=self.scan); self.scan_btn.pack(side='left')
        self.sort_btn = ctk.CTkButton(actions, text='Sort + Generate fxmanifest', command=self.sort, state='disabled'); self.sort_btn.pack(side='left', padx=8)
        ctk.CTkButton(actions, text='Open Output', command=self.open_output, fg_color='transparent', border_width=1).pack(side='right')
        columns = ('category', 'confidence', 'file', 'reason')
        self.tree = ttk.Treeview(frame, columns=columns, show='headings')
        for key, title, width in [('category','Category',155),('confidence','Confidence',90),('file','File',250),('reason','Reason',430)]:
            self.tree.heading(key, text=title); self.tree.column(key, width=width, anchor='center' if key=='confidence' else 'w')
        self.tree.grid(row=1, column=0, padx=14, pady=(0, 14), sticky='nsew')
        sb = ttk.Scrollbar(frame, orient='vertical', command=self.tree.yview); sb.grid(row=1, column=1, pady=(0, 14), sticky='ns'); self.tree.configure(yscrollcommand=sb.set)

    def _build_footer(self):
        ctk.CTkLabel(self, textvariable=self.status_var, anchor='w').grid(row=3, column=0, padx=22, pady=(0, 14), sticky='ew')

    def pick_source(self):
        path = filedialog.askdirectory(title='Pilih folder FiveM')
        if path:
            self.source_var.set(path)
            if not self.output_var.get(): self.output_var.set(str(Path(path).parent / 'Ditasha_Sorted'))

    def pick_output(self):
        path = filedialog.askdirectory(title='Pilih folder output')
        if path: self.output_var.set(path)

    def _validate(self):
        src = Path(self.source_var.get().strip()); out = Path(self.output_var.get().strip()) if self.output_var.get().strip() else None
        if not src.is_dir(): messagebox.showerror(APP_NAME, 'Source folder tidak valid.'); return None, None
        if out is None: out = src.parent / 'Ditasha_Sorted'; self.output_var.set(str(out))
        return src, out

    def scan(self):
        src, out = self._validate()
        if not src: return
        self.scan_btn.configure(state='disabled'); self.sort_btn.configure(state='disabled'); self.status_var.set('Scanning...')
        def work():
            try:
                self.scanned = scan_folder(src, out); self.after(0, self._render_scan)
            except Exception as exc:
                self.after(0, lambda: messagebox.showerror(APP_NAME, f'Scan gagal:\n{exc}')); self.after(0, lambda: self.scan_btn.configure(state='normal'))
        threading.Thread(target=work, daemon=True).start()

    def _render_scan(self):
        for item in self.tree.get_children(): self.tree.delete(item)
        for item in self.scanned: self.tree.insert('', 'end', values=(item.category, item.confidence, item.filename, item.reason))
        counts = Counter(i.category for i in self.scanned); summary = ', '.join(f'{k}: {v}' for k, v in counts.most_common())
        self.status_var.set(f'{len(self.scanned)} file terdeteksi. {summary}' if self.scanned else 'Tidak ada file yang dikenali.')
        self.scan_btn.configure(state='normal'); self.sort_btn.configure(state='normal' if self.scanned else 'disabled')

    def sort(self):
        src, out = self._validate()
        if not src or not self.scanned: return
        self.sort_btn.configure(state='disabled'); self.status_var.set('Sorting files dan membuat fxmanifest...')
        def work():
            try:
                summary = sort_files(self.scanned, src, out, self.mode_var.get()); manifests = generate_all_manifests(out)
                msg = f'Selesai. Copy: {summary.copied}, Move: {summary.moved}, Duplicate sama: {summary.skipped_identical}, Conflict: {summary.conflicts}.\nfxmanifest dibuat: {len(manifests)}'
                self.after(0, lambda: self.status_var.set(msg.replace('\n', ' | '))); self.after(0, lambda: messagebox.showinfo(APP_NAME, msg))
            except Exception as exc:
                self.after(0, lambda: messagebox.showerror(APP_NAME, f'Sorting gagal:\n{exc}'))
            finally:
                self.after(0, lambda: self.sort_btn.configure(state='normal'))
        threading.Thread(target=work, daemon=True).start()

    def open_output(self):
        path = Path(self.output_var.get().strip())
        if not path.exists(): messagebox.showwarning(APP_NAME, 'Output folder belum ada.'); return
        if os.name == 'nt': os.startfile(path)
        elif os.name == 'posix': subprocess.Popen(['xdg-open', str(path)])


if __name__ == '__main__':
    App().mainloop()
