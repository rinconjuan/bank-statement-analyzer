import { Lang } from './translations'

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'Salario': 'Salary',
  'Pago/Abono Tarjeta': 'Card Payment/Credit',
  'Telecomunicaciones': 'Telecommunications',
  'Streaming': 'Streaming',
  'Videojuegos': 'Video Games',
  'Combustible': 'Fuel',
  'Mercado/Alimentación': 'Groceries/Food',
  'Salud/Farmacia': 'Health/Pharmacy',
  'Mascotas': 'Pets',
  'Regalos': 'Gifts',
  'Seguros': 'Insurance',
  'Restaurantes': 'Restaurants',
  'Transporte': 'Transport',
  'Compras': 'Shopping',
  'Servicios': 'Utilities',
  'Comisiones': 'Fees',
  'Transferencia': 'Transfer',
  'Otros': 'Other',
  'Sin categoría': 'Uncategorized',
}

export function translateCategoryName(name: string, lang: Lang): string {
  if (lang !== 'en') return name
  return CATEGORY_TRANSLATIONS[name] ?? name
}
