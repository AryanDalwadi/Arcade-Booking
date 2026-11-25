import { AppCheckbox, secondaryButtonClass, Select } from './ui';

const PAGE_SIZES = [5, 10, 15, 25] as const;

export function TableFooter({
  dense,
  onDenseChange,
  pageSize,
  onPageSizeChange,
  totalRecords,
  currentPage,
  totalPages,
  onPageChange,
}: {
  dense: boolean;
  onDenseChange: (dense: boolean) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalRecords: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted">
      <div className="flex items-center gap-2">
        <AppCheckbox checked={dense} onChange={onDenseChange} aria-label="Dense table rows" />
        <span>Dense</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          Rows per page
          <Select
            wrapperClassName="!w-auto"
            className="min-w-[4.5rem] py-1.5 pl-2 text-xs"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </Select>
        </label>
        <span>Total Records: {totalRecords}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={secondaryButtonClass('px-2 py-1')}
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            ‹
          </button>
          <span className="min-w-8 text-center">{currentPage}</span>
          <button
            type="button"
            className={secondaryButtonClass('px-2 py-1')}
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            ›
          </button>
        </div>
      </div>
    </footer>
  );
}
