"""
Analizador de Extractos Bancarios
Carga PDFs, categoriza movimientos y genera reportes
"""

import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import pandas as pd
import pdfplumber
import re
from pathlib import Path
from datetime import datetime
import json
from collections import defaultdict

class BankStatementAnalyzer:
    def __init__(self, root):
        self.root = root
        self.root.title("Analizador de Extractos Bancarios")
        self.root.geometry("1200x700")
        
        # Datos
        self.df = None
        self.categorized_df = None
        
        # Categorías por defecto
        self.categories = {
            'Salario': ['salario', 'sueldo', 'pago', 'compensación'],
            'Transferencia': ['transferencia', 'envío', 'giro'],
            'Compras': ['compra', 'pago en tienda', 'comercio', 'retail'],
            'Servicios': ['servicios', 'luz', 'agua', 'gas', 'internet', 'teléfono'],
            'Comisiones': ['comisión', 'comisiones', 'mantenimiento'],
            'Otros': []
        }
        
        self.setup_ui()
    
    def setup_ui(self):
        """Crea la interfaz gráfica"""
        
        # Marco superior - Controles
        control_frame = ttk.LabelFrame(self.root, text="Controles", padding=10)
        control_frame.pack(fill="x", padx=10, pady=10)
        
        ttk.Button(control_frame, text="📄 Cargar PDF", 
                   command=self.load_pdf).pack(side="left", padx=5)
        ttk.Button(control_frame, text="🔄 Categorizar", 
                   command=self.categorize_movements).pack(side="left", padx=5)
        ttk.Button(control_frame, text="💾 Exportar CSV", 
                   command=self.export_csv).pack(side="left", padx=5)
        ttk.Button(control_frame, text="📊 Exportar Excel", 
                   command=self.export_excel).pack(side="left", padx=5)
        
        # Notebook para pestañas
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Pestaña 1: Movimientos
        self.movements_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.movements_frame, text="Movimientos")
        self.setup_movements_tab()
        
        # Pestaña 2: Resumen
        self.summary_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.summary_frame, text="Resumen por Categoría")
        self.setup_summary_tab()
        
        # Pestaña 3: Configuración
        self.config_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.config_frame, text="Configuración")
        self.setup_config_tab()
    
    def setup_movements_tab(self):
        """Pestaña de movimientos"""
        # Tabla de movimientos
        self.tree = ttk.Treeview(self.movements_frame, 
                                  columns=('Fecha', 'Descripción', 'Monto', 'Tipo', 'Categoría'),
                                  height=20)
        self.tree.column('#0', width=0, stretch=tk.NO)
        self.tree.column('Fecha', anchor=tk.W, width=100)
        self.tree.column('Descripción', anchor=tk.W, width=350)
        self.tree.column('Monto', anchor=tk.E, width=100)
        self.tree.column('Tipo', anchor=tk.CENTER, width=80)
        self.tree.column('Categoría', anchor=tk.CENTER, width=120)
        
        self.tree.heading('#0', text='', anchor=tk.W)
        self.tree.heading('Fecha', text='Fecha', anchor=tk.W)
        self.tree.heading('Descripción', text='Descripción', anchor=tk.W)
        self.tree.heading('Monto', text='Monto', anchor=tk.E)
        self.tree.heading('Tipo', text='Tipo', anchor=tk.CENTER)
        self.tree.heading('Categoría', text='Categoría', anchor=tk.CENTER)
        
        # Scrollbar
        scrollbar = ttk.Scrollbar(self.movements_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscroll=scrollbar.set)
        
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def setup_summary_tab(self):
        """Pestaña de resumen"""
        self.summary_text = tk.Text(self.summary_frame, height=30, width=100)
        self.summary_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
    
    def setup_config_tab(self):
        """Pestaña de configuración de categorías"""
        config_label = ttk.Label(self.config_frame, 
                                 text="Palabras clave por categoría (JSON):", 
                                 font=("Arial", 10, "bold"))
        config_label.pack(anchor="nw", padx=10, pady=10)
        
        self.config_text = tk.Text(self.config_frame, height=25, width=100)
        self.config_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Cargar configuración inicial
        self.config_text.insert(1.0, json.dumps(self.categories, ensure_ascii=False, indent=2))
        
        ttk.Button(self.config_frame, text="💾 Guardar Configuración", 
                   command=self.save_config).pack(pady=10)
    
    def load_pdf(self):
        """Carga un archivo PDF"""
        file_path = filedialog.askopenfilename(
            filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")]
        )
        
        if not file_path:
            return
        
        try:
            movements = []
            
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    # Buscar patrones de movimientos
                    # Formato: fecha | descripción | monto
                    patterns = re.findall(
                        r'(\d{2}/\d{2})\s+(.+?)\s+(-?\d+[.,]\d{2})',
                        text
                    )
                    
                    for date, description, amount in patterns:
                        movements.append({
                            'Fecha': date,
                            'Descripción': description.strip(),
                            'Monto': float(amount.replace(',', '.')),
                            'Tipo': 'Egreso' if float(amount.replace(',', '.')) < 0 else 'Ingreso',
                            'Categoría': 'Sin asignar'
                        })
            
            if movements:
                self.df = pd.DataFrame(movements)
                self.display_movements()
                messagebox.showinfo("Éxito", f"Se cargaron {len(movements)} movimientos")
            else:
                messagebox.showwarning("Advertencia", "No se encontraron movimientos en el PDF")
        
        except Exception as e:
            messagebox.showerror("Error", f"Error al cargar PDF: {str(e)}")
    
    def categorize_movements(self):
        """Categoriza automáticamente los movimientos"""
        if self.df is None:
            messagebox.showwarning("Advertencia", "Por favor carga un PDF primero")
            return
        
        def find_category(description):
            description_lower = description.lower()
            for category, keywords in self.categories.items():
                if any(keyword in description_lower for keyword in keywords):
                    return category
            return 'Otros'
        
        self.df['Categoría'] = self.df['Descripción'].apply(find_category)
        self.categorized_df = self.df.copy()
        self.display_movements()
        self.show_summary()
        messagebox.showinfo("Éxito", "Movimientos categorizados correctamente")
    
    def display_movements(self):
        """Muestra los movimientos en la tabla"""
        # Limpiar tabla
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        if self.df is None:
            return
        
        for idx, row in self.df.iterrows():
            values = (
                row['Fecha'],
                row['Descripción'][:40],
                f"${row['Monto']:.2f}",
                row['Tipo'],
                row['Categoría']
            )
            self.tree.insert('', 'end', values=values)
    
    def show_summary(self):
        """Muestra el resumen por categoría"""
        if self.categorized_df is None:
            return
        
        self.summary_text.delete(1.0, tk.END)
        
        summary = "=" * 80 + "\n"
        summary += "RESUMEN DE MOVIMIENTOS BANCARIOS\n"
        summary += f"Fecha de generación: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n"
        summary += "=" * 80 + "\n\n"
        
        # Totales por categoría
        category_summary = self.categorized_df.groupby('Categoría')['Monto'].agg(['sum', 'count'])
        
        summary += "TOTALES POR CATEGORÍA:\n"
        summary += "-" * 80 + "\n"
        summary += f"{'Categoría':<30} {'Total':<20} {'Transacciones':<15}\n"
        summary += "-" * 80 + "\n"
        
        grand_total = 0
        for category, row in category_summary.iterrows():
            total = row['sum']
            count = int(row['count'])
            grand_total += total
            summary += f"{category:<30} ${total:>18,.2f} {count:>14}\n"
        
        summary += "-" * 80 + "\n"
        summary += f"{'TOTAL GENERAL':<30} ${grand_total:>18,.2f}\n"
        summary += "=" * 80 + "\n\n"
        
        # Detalles por categoría
        summary += "DETALLE POR CATEGORÍA:\n"
        summary += "=" * 80 + "\n\n"
        
        for category in self.categorized_df['Categoría'].unique():
            cat_data = self.categorized_df[self.categorized_df['Categoría'] == category]
            summary += f"\n{category.upper()}\n"
            summary += "-" * 80 + "\n"
            summary += f"{'Fecha':<12} {'Descripción':<40} {'Monto':>15}\n"
            summary += "-" * 80 + "\n"
            
            for _, row in cat_data.iterrows():
                summary += f"{row['Fecha']:<12} {row['Descripción'][:38]:<40} ${row['Monto']:>13,.2f}\n"
            
            summary += f"\nSubtotal {category}: ${cat_data['Monto'].sum():,.2f}\n"
            summary += "=" * 80 + "\n"
        
        self.summary_text.insert(1.0, summary)
    
    def export_csv(self):
        """Exporta los datos a CSV"""
        if self.df is None:
            messagebox.showwarning("Advertencia", "No hay datos para exportar")
            return
        
        file_path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")]
        )
        
        if file_path:
            self.df.to_csv(file_path, index=False, encoding='utf-8-sig')
            messagebox.showinfo("Éxito", f"Archivo guardado en: {file_path}")
    
    def export_excel(self):
        """Exporta los datos a Excel con formato"""
        if self.df is None:
            messagebox.showwarning("Advertencia", "No hay datos para exportar")
            return
        
        file_path = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")]
        )
        
        if file_path:
            try:
                with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
                    # Movimientos
                    self.df.to_excel(writer, sheet_name='Movimientos', index=False)
                    
                    # Resumen por categoría
                    if self.categorized_df is not None:
                        summary = self.categorized_df.groupby('Categoría')['Monto'].agg(['sum', 'count'])
                        summary.to_excel(writer, sheet_name='Resumen')
                
                messagebox.showinfo("Éxito", f"Archivo guardado en: {file_path}")
            except Exception as e:
                messagebox.showerror("Error", f"Error al exportar: {str(e)}")
    
    def save_config(self):
        """Guarda la configuración de categorías"""
        try:
            config_text = self.config_text.get(1.0, tk.END)
            self.categories = json.loads(config_text)
            messagebox.showinfo("Éxito", "Configuración guardada")
        except json.JSONDecodeError:
            messagebox.showerror("Error", "JSON inválido en la configuración")


def main():
    root = tk.Tk()
    app = BankStatementAnalyzer(root)
    root.mainloop()


if __name__ == "__main__":
    main()