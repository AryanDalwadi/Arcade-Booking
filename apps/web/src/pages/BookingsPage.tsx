import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FilterBar, FilterSelect, FilterTextInput } from '../components/FilterBar';
import { Modal } from '../components/Modal';
import { TableFooter } from '../components/TableFooter';
import {
  PageTitle,
  ResourceMessage,
  errorClass,
  fieldClass,
  inputClass,
  noteClass,
  primaryButtonClass,
  secondaryButtonClass,
  Select,
  statusPillClass,
  tableClass,
  tableWrapClass,
  tdClass,
  textButtonClass,
  thClass,
  toolbarPrimaryButtonClass,
} from '../components/ui';
import { createBooking, deleteBooking, fetchBookings, updateBooking, type BookingListItem } from '../features/bookingsSlice';
import { confirmRazorpayCheckout, createCheckoutOrder, simulateCheckout, syncPaidBooking } from '../features/paymentsSlice';
import { openRazorpayCheckout } from '../features/razorpayCheckout';
import { fetchMachines } from '../features/catalogSlice';
import { fetchUsers } from '../features/identitySlice';
import { useMenuAccess } from '../features/menuAccess';
import { useAppDispatch, useAppSelector } from '../store';

type DialogMode = 'closed' | 'create' | 'edit';

const statusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING_PAYMENT', label: 'Pending payment' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PAYMENT_FAILED', label: 'Payment failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function BookingsPage({ portal }: { portal: 'customer' | 'admin' }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const menuRights = useMenuAccess('/admin/bookings');
  const canAdd = portal === 'customer' || menuRights.canAdd;
  const canEdit = portal === 'customer' || menuRights.canEdit;
  const canDelete = portal === 'customer' || menuRights.canDelete;
  const showActions = canEdit || canDelete;
  const { machines, status: machinesStatus } = useAppSelector((state) => state.catalog);
  const { users } = useAppSelector((state) => state.identity);
  const { bookings, listStatus, listError, mutationStatus, mutationError } =
    useAppSelector((state) => state.bookings);
  const { payingBookingId, payError } = useAppSelector((state) => state.payments);
  const availableMachines = machines.filter((machine) => machine.status === 'ACTIVE');
  const visibleBookings = useMemo(
    () => portal === 'admin' ? bookings : bookings.filter((booking) => booking.userId === user?.id),
    [bookings, portal, user?.id],
  );

  const [playerFilter, setPlayerFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dense, setDense] = useState(false);
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [dialogMode, setDialogMode] = useState<DialogMode>('closed');
  const [selected, setSelected] = useState<BookingListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookingListItem | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [paidBookingIds, setPaidBookingIds] = useState<string[]>([]);

  useEffect(() => {
    void dispatch(fetchMachines());
  }, [dispatch]);

  useEffect(() => {
    if (portal === 'admin') void dispatch(fetchUsers());
  }, [dispatch, portal]);

  const bookingScope = portal === 'admin' ? undefined : user?.id;

  const refreshUntilSettled = useCallback(async (bookingId: string) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const latest = await dispatch(fetchBookings(bookingScope)).unwrap();
      const current = latest.find((booking) => booking.id === bookingId);
      if (!current || current.status !== 'PENDING_PAYMENT' || current.paymentStatus === 'COMPLETED') return;
    }
  }, [bookingScope, dispatch]);

  useEffect(() => {
    void dispatch(fetchBookings(bookingScope));
  }, [bookingScope, dispatch]);

  const syncedBookingIds = useRef(new Set<string>());
  const pageAlive = useRef(true);
  useEffect(() => () => {
    pageAlive.current = false;
  }, []);

  useEffect(() => {
    if (listStatus !== 'succeeded') return;
    const pending = visibleBookings.filter((booking) => (
      booking.status === 'PENDING_PAYMENT'
      && booking.paymentStatus !== 'COMPLETED'
      && !syncedBookingIds.current.has(booking.id)
    ));
    if (pending.length === 0) return;
    void (async () => {
      for (const booking of pending) {
        syncedBookingIds.current.add(booking.id);
        try {
          const result = await dispatch(syncPaidBooking(booking.id)).unwrap();
          if (!pageAlive.current || !result.alreadyPaid) continue;
          setPaidBookingIds((current) => current.includes(booking.id) ? current : [...current, booking.id]);
          await refreshUntilSettled(booking.id);
        } catch {
          // Leave the id recorded so a failed lookup does not retry on every render. Pay now stays available.
        }
      }
    })();
  }, [dispatch, listStatus, refreshUntilSettled, visibleBookings]);

  const confirmingKey = visibleBookings
    .filter((booking) => booking.status === 'PENDING_PAYMENT' && (booking.paymentStatus === 'COMPLETED' || paidBookingIds.includes(booking.id)))
    .map((booking) => booking.id)
    .sort()
    .join(',');

  useEffect(() => {
    if (!confirmingKey) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attempts > 12) {
        clearInterval(timer);
        return;
      }
      void dispatch(fetchBookings(bookingScope));
    }, 2000);
    return () => clearInterval(timer);
  }, [bookingScope, confirmingKey, dispatch]);

  const filtered = useMemo(() => {
    const playerTerm = playerFilter.trim().toLowerCase();
    const machineTerm = machineFilter.trim().toLowerCase();
    return visibleBookings.filter((booking) => {
      if (statusFilter !== 'ALL' && booking.status !== statusFilter) return false;
      if (machineTerm) {
        const machineName = bookingLabel(booking, machines);
        if (!machineName.toLowerCase().includes(machineTerm)) return false;
      }
      if (portal === 'admin' && playerTerm) {
        const label = userLabel(booking.userId, users).toLowerCase();
        if (!label.includes(playerTerm)) return false;
      }
      return true;
    });
  }, [visibleBookings, statusFilter, machineFilter, playerFilter, machines, portal, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function openCreate() {
    setSelected(null);
    setCustomerId(users[0]?.id ?? '');
    setMachineId(availableMachines[0]?.id ?? '');
    setStartAt('');
    setDurationMinutes(60);
    setDialogMode('create');
  }

  function openEdit(booking: BookingListItem) {
    if (!booking.machineId) return;
    setSelected(booking);
    setCustomerId(booking.userId);
    setMachineId(booking.machineId);
    setStartAt(toLocalInput(booking.startAt));
    setDurationMinutes(booking.durationMinutes);
    setDialogMode('edit');
  }

  function closeDialog() {
    setDialogMode('closed');
    setSelected(null);
  }

  async function saveBooking(event: FormEvent) {
    event.preventDefault();
    if (!user || !machineId) return;
    if (dialogMode === 'create' && !canAdd) return;
    if (dialogMode === 'edit' && !canEdit) return;
    const startIso = new Date(startAt).toISOString();
    try {
      if (dialogMode === 'create') {
        await dispatch(createBooking({
          machineId,
          startAt: startIso,
          durationMinutes,
          ...(user.email ? { customerEmail: user.email } : {}),
          ...(portal === 'admin' && customerId ? { userId: customerId } : {}),
        })).unwrap();
        setSuccessMessage('Booking created successfully.');
      } else if (selected) {
        await dispatch(updateBooking({
          id: selected.id,
          machineId,
          startAt: startIso,
          durationMinutes,
        })).unwrap();
        setSuccessMessage('Booking updated successfully.');
      }
      closeDialog();
      await dispatch(fetchBookings(portal === 'admin' ? undefined : user.id));
    } catch {
      // mutationError is shown in the dialog
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const confirmed = deleteTarget.status === 'CONFIRMED';
    try {
      await dispatch(deleteBooking(deleteTarget.id)).unwrap();
      setDeleteTarget(null);
      setSuccessMessage(confirmed ? 'Booking cancelled successfully.' : 'Booking deleted successfully.');
    } catch {
      // mutationError is shown below the table
    }
  }

  async function pay(bookingId: string) {
    try {
      const order = await dispatch(createCheckoutOrder(bookingId)).unwrap();
      if (order.alreadyPaid) {
        setPaidBookingIds((current) => current.includes(bookingId) ? current : [...current, bookingId]);
        await refreshUntilSettled(bookingId);
        return;
      }
      if (order.provider === 'SIMULATED') {
        await dispatch(simulateCheckout({ bookingId, outcome: 'SUCCEED' })).unwrap();
      } else {
        const paid = await openRazorpayCheckout({
          keyId: order.keyId,
          amountCents: order.amountCents,
          currency: order.currency,
          orderId: order.orderId,
        });
        await dispatch(confirmRazorpayCheckout({
          bookingId,
          orderId: paid.razorpay_order_id,
          paymentId: paid.razorpay_payment_id,
          signature: paid.razorpay_signature,
        })).unwrap();
      }
      await refreshUntilSettled(bookingId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.toLowerCase().includes('already completed')) {
        await refreshUntilSettled(bookingId);
      }
    }
  }

  function paymentCaptured(booking: BookingListItem) {
    return booking.paymentStatus === 'COMPLETED' || paidBookingIds.includes(booking.id);
  }

  const cellClass = dense ? `${tdClass} !py-2` : tdClass;
  const loading = listStatus === 'loading' || listStatus === 'idle';
  const columnCount = (portal === 'admin' ? 1 : 0) + (showActions ? 1 : 0) + 6;

  return (
    <>
      <PageTitle
        eyebrow={portal === 'admin' ? 'OPERATIONS' : 'BOOKINGS'}
        title={portal === 'admin' ? 'Bookings' : 'My bookings'}
        action={canAdd ? (
          <button type="button" className={toolbarPrimaryButtonClass('px-5')} onClick={openCreate}>
            + New
          </button>
        ) : undefined}
      />

      <FilterBar>
        <div className={`grid gap-4 ${portal === 'admin' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {portal === 'admin' && (
            <FilterTextInput label="Player" value={playerFilter} onChange={(value) => { setPlayerFilter(value); setPage(1); }} placeholder="Filter player…" />
          )}
          <FilterTextInput label="Machine / party" value={machineFilter} onChange={(value) => { setMachineFilter(value); setPage(1); }} placeholder="Filter machine or party…" />
          <FilterSelect label="Status" value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} options={statusOptions} />
        </div>
      </FilterBar>

      {successMessage && (
        <ResourceMessage kind="success">
          {successMessage}
          <button type="button" className={`${textButtonClass} ml-2`} onClick={() => setSuccessMessage(null)}>Dismiss</button>
        </ResourceMessage>
      )}
      {payError && <div className={`${errorClass} mb-4`} role="alert">{payError}</div>}

      {listStatus === 'failed' && (
        <ResourceMessage kind="error">
          {listError}{' '}
          <button type="button" className={textButtonClass} onClick={() => void dispatch(fetchBookings(portal === 'admin' ? undefined : user?.id))}>Retry</button>
        </ResourceMessage>
      )}

      {deleteTarget && mutationError && (
        <div className={`${errorClass} mb-4`} role="alert">{mutationError}</div>
      )}

      {loading && <ResourceMessage kind="loading">Loading bookings…</ResourceMessage>}

      {listStatus === 'succeeded' && (
        <section className={tableWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr>
                {showActions && <th className={thClass}>Actions</th>}
                <th className={thClass}>Sr. No.</th>
                {portal === 'admin' && <th className={thClass}>User</th>}
                <th className={thClass}>Machine / party</th>
                <th className={thClass}>Start</th>
                <th className={thClass}>Duration</th>
                <th className={thClass}>Amount</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td className={tdClass} colSpan={columnCount}>No bookings found.</td>
                </tr>
              )}
              {pageRows.map((booking, index) => {
                const captured = paymentCaptured(booking);
                const editable = canEdit && !captured && Boolean(booking.machineId) && (booking.status === 'PENDING_PAYMENT' || booking.status === 'PAYMENT_FAILED');
                const removable = canDelete && !captured && booking.status !== 'CANCELLED';
                return (
                  <tr key={booking.id} className="hover:bg-white/2">
                    {showActions && (
                      <td className={cellClass}>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {editable && <button type="button" className={textButtonClass} onClick={() => openEdit(booking)}>Edit</button>}
                          {removable && <button type="button" className={textButtonClass} onClick={() => setDeleteTarget(booking)}>Delete</button>}
                        </div>
                      </td>
                    )}
                    <td className={cellClass}>{(currentPage - 1) * pageSize + index + 1}</td>
                    {portal === 'admin' && <td className={cellClass}>{userLabel(booking.userId, users)}</td>}
                    <td className={cellClass}>{bookingLabel(booking, machines)}</td>
                    <td className={cellClass}>{new Date(booking.startAt).toLocaleString()}</td>
                    <td className={cellClass}>{booking.durationMinutes} min</td>
                    <td className={cellClass}>{formatMoney(booking.amountCents, booking.currency)}</td>
                    <td className={cellClass}>
                      <div className="flex items-center gap-3">
                        <b className={statusPillClass}>{booking.status.replaceAll('_', ' ')}</b>
                        {booking.status === 'PENDING_PAYMENT' && captured && (
                          <span className="text-sm text-mint">Payment received</span>
                        )}
                        {booking.status === 'PENDING_PAYMENT' && !captured && (
                          <button
                            className={primaryButtonClass('w-auto whitespace-nowrap px-3 py-1.5 text-[13px]')}
                            disabled={payingBookingId === booking.id}
                            onClick={() => void pay(booking.id)}
                          >
                            {payingBookingId === booking.id ? 'Starting checkout…' : 'Pay now'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TableFooter
            dense={dense}
            onDenseChange={setDense}
            pageSize={pageSize}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            totalRecords={filtered.length}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </section>
      )}

      <Modal
        open={dialogMode !== 'closed'}
        title={dialogMode === 'create' ? 'New booking' : 'Edit booking'}
        subtitle={dialogMode === 'edit' ? selected?.id : undefined}
        onClose={closeDialog}
        footer={(
          <>
            <button type="button" className={secondaryButtonClass()} onClick={closeDialog}>Cancel</button>
            <button type="submit" form="booking-form" className={primaryButtonClass('w-auto min-w-[88px]')} disabled={mutationStatus === 'loading' || !machineId}>
              {mutationStatus === 'loading' ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      >
        <form id="booking-form" className="grid gap-4" onSubmit={(event) => void saveBooking(event)}>
          {portal === 'admin' && dialogMode === 'create' && (
            <label className={fieldClass}>
              Player *
              <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
                <option value="">Select a player</option>
                {users.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.displayName} ({candidate.email})</option>
                ))}
              </Select>
            </label>
          )}
          <label className={fieldClass}>
            Arcade machine *
            <Select value={machineId} onChange={(event) => setMachineId(event.target.value)} required>
              <option value="">Select a machine</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id} disabled={dialogMode === 'create' && machine.status !== 'ACTIVE'}>
                  {machine.name}
                </option>
              ))}
            </Select>
          </label>
          {machinesStatus === 'loading' && <ResourceMessage kind="loading">Loading available machines…</ResourceMessage>}
          {machinesStatus === 'succeeded' && availableMachines.length === 0 && dialogMode === 'create' && (
            <ResourceMessage kind="empty">No active machines are available.</ResourceMessage>
          )}
          <label className={fieldClass}>
            Start time *
            <input className={inputClass} type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required />
          </label>
          <label className={fieldClass}>
            Duration in minutes *
            <input className={inputClass} type="number" min={15} max={480} step={15} value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.valueAsNumber)} required />
          </label>
          <p className={noteClass}>The final amount is calculated from Catalog pricing. Unpaid bookings can be edited. A confirmed booking is cancelled instead of removed.</p>
          {mutationError && <div className={errorClass} role="alert">{mutationError}</div>}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.status === 'CONFIRMED' ? 'Cancel booking?' : 'Delete booking?'}
        message={deleteTarget?.status === 'CONFIRMED'
          ? 'This confirmed booking will be cancelled.'
          : 'Are you sure you want to delete this record?'}
        confirmLabel="Confirm"
        loading={mutationStatus === 'loading'}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

function bookingLabel(booking: BookingListItem, machines: { id: string; name: string }[]): string {
  if (booking.packageCode) {
    const guests = booking.guestCount ? ` · ${booking.guestCount} guests` : '';
    return `${booking.packageCode} party${guests}`;
  }
  if (!booking.machineId) return 'Party';
  return machines.find((machine) => machine.id === booking.machineId)?.name ?? booking.machineId;
}

function userLabel(userId: string, users: { id: string; displayName: string; email: string }[]): string {
  const match = users.find((candidate) => candidate.id === userId);
  return match ? `${match.displayName} (${match.email})` : userId;
}

function formatMoney(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
