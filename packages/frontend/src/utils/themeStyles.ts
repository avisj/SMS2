// ========================================================================
// Shared Style Tokens & Helper Classes
// Centralized classes for Tables, Pagination, Checkboxes, Tabs, Cards & Links
// Guarantees consistent stable eSchool teal identity across all modules
// ========================================================================

export const tableStyles = {
  // Selected table row highlight
  rowSelected: 'bg-teal-50/80 hover:bg-teal-100/70 border-l-2 border-l-teal-600 transition-colors',
  // Standard table row
  rowDefault: 'hover:bg-slate-50/80 transition-colors',
  // Active table filter pill
  filterActive: 'bg-teal-50 border-teal-300 text-teal-900 font-semibold shadow-2xs',
  filterDefault: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300',
  // Table pagination
  paginationActive: 'bg-teal-600 text-white font-semibold shadow-xs',
  paginationDefault: 'bg-white border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200',
  // Table checkbox / radio
  checkbox: 'rounded border-slate-300 text-teal-600 focus:ring-teal-500 accent-teal-600 cursor-pointer',
  radio: 'border-slate-300 text-teal-600 focus:ring-teal-500 accent-teal-600 cursor-pointer',
  // Primary Link
  link: 'text-teal-600 hover:text-teal-800 hover:underline font-medium transition-colors',
  // Active Section / Card highlight border
  cardHighlight: 'border-l-4 border-l-teal-600',
  // Tab Bar in Modules
  tabActive: 'border-teal-600 text-teal-700 font-semibold',
  tabInactive: 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
};
