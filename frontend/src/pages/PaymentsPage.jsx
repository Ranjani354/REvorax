import { useState } from 'react'
import { useRcm, paginate } from '../context/RcmContext'
import PageShell from '../components/PageShell'
import '../App.css'

export default function PaymentsPage() {
  const {
    claims,
    payments, setPayments,
    paymentForm, setPaymentForm,
    showCreatePayment, setShowCreatePayment,
    showPaymentFilters, setShowPaymentFilters,
    handleCreatePayment,
    showToast, toasts,
  } = useRcm()

  const [paymentPage, setPaymentPage] = useState(1)
  const paymentPageSize = 10

  const claimIds = new Set(claims.map((claim) => String(claim.claimId || claim.id)))
  const allPayments = claimIds.size === 0 ? [] : payments.filter((payment) => claimIds.has(String(payment.claim || '')))
  const { items: paginatedPayments, currentPage: paymentCurrentPage, totalPages: paymentTotalPages, hasPrev: paymentHasPrev, hasNext: paymentHasNext } = paginate(allPayments, paymentPage, paymentPageSize)
  const paymentTotal = allPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

  return (
    <>
      <PageShell title="Payments" subtitle="Track and manage payment postings">
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>

        <div className="claims-view">
          <div className="claims-header-row">
            <div>
              <h2>Payments</h2>
              <p>Track and manage payment postings</p>
            </div>
            <div className="claims-actions">
              <button type="button" className="filter-button" onClick={() => setShowPaymentFilters((current) => !current)}>⌄ Filters</button>
              <button type="button" className="primary-button claims-create-button" onClick={() => setShowCreatePayment(true)}>＋ Post Payment</button>
            </div>
        </div>

        <div className="stat-grid">
          <article className="stat-card success">
            <span>Total Payments</span>
            <strong>{allPayments.length}</strong>
          </article>
          <article className="stat-card success">
            <span>Total Amount</span>
            <strong>${paymentTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </article>
          <article className="stat-card success">
            <span>Avg Payment</span>
            <strong>${(allPayments.length ? paymentTotal / allPayments.length : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </article>
          <article className="stat-card success">
            <span>Unique Payers</span>
            <strong>{new Set(allPayments.map((payment) => payment.payer)).size}</strong>
          </article>
        </div>

        {allPayments.length === 0 && (
          <div className="empty-state" style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '12px', background: '#f5f7fb', color: '#58667a', textAlign: 'center' }}>
            No payments exist for the current claim set.
          </div>
        )}

        {showPaymentFilters && (
          <div className="claims-filter-panel">
            <div className="filter-field">
              <label>Payer</label>
              <select defaultValue="All Payers">
                <option>All Payers</option>
                <option>Payer 1</option>
                <option>Payer 2</option>
                <option>Aetna (ID: 3)</option>
              </select>
            </div>
            <div className="filter-field">
              <label>Posted From</label>
              <input type="date" />
            </div>
            <div className="filter-field">
              <label>Posted To</label>
              <input type="date" />
            </div>
            <div className="filter-field">
              <label>Search</label>
              <input type="text" placeholder="Search payment or claim" />
            </div>
          </div>
        )}

        <div className="claims-table-wrap">
          {allPayments.length === 0 ? null : (
            <table className="claims-table">
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Claim</th>
                  <th>Amount</th>
                  <th>Posted Date</th>
                  <th>Remittance Ref</th>
                  <th>Payer</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.paymentId}</td>
                    <td>{payment.claim}</td>
                    <td>${Number(payment.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>{payment.postedDate}</td>
                    <td>{payment.remittanceRef}</td>
                    <td>{payment.payer}</td>
                    <td className="table-actions">
                      <button type="button" className="icon-button" onClick={() => setShowCreatePayment(true)}>✎</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          )}

          {allPayments.length > paymentPageSize && (
            <div className="pagination-bar">
              <button
                type="button"
                className="pagination-button"
                disabled={!paymentHasPrev}
                onClick={() => setPaymentPage(paymentCurrentPage - 1)}
              >
                ← Prev
              </button>
              <span className="pagination-info">Page {paymentCurrentPage} of {paymentTotalPages}</span>
              <button
                type="button"
                className="pagination-button"
                disabled={!paymentHasNext}
                onClick={() => setPaymentPage(paymentCurrentPage + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {showCreatePayment && (
          <div className="claim-modal-backdrop" onClick={() => setShowCreatePayment(false)}>
            <div className="claim-modal" onClick={(event) => event.stopPropagation()}>
              <div className="claim-modal-header">
                <h3>Post New Payment</h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowCreatePayment(false)}>×</button>
              </div>

              <form className="claim-form" onSubmit={handleCreatePayment}>
                <div className="claim-grid">
                  <label className="full-width">
                    Claim ID *
                    <input
                      type="text"
                      value={paymentForm.claimId}
                      onChange={(event) => setPaymentForm((current) => ({ ...current, claimId: event.target.value }))}
                      placeholder="e.g. 52"
                      required
                    />
                  </label>

                  <label className="full-width">
                    Payment Amount ($) *
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                      placeholder="e.g. 1500.00"
                      required
                    />
                  </label>

                  <label className="full-width">
                    Payer *
                    <select value={paymentForm.payer} onChange={(event) => setPaymentForm((current) => ({ ...current, payer: event.target.value }))}>
                      <option value="Aetna (ID: 3)">Aetna (ID: 3)</option>
                      <option value="Payer 1">Payer 1</option>
                      <option value="Payer 2">Payer 2</option>
                      <option value="UnitedHealthcare">UnitedHealthcare</option>
                    </select>
                  </label>

                  <label className="full-width">
                    Posted Date *
                    <input
                      type="date"
                      value={paymentForm.postedDate}
                      onChange={(event) => setPaymentForm((current) => ({ ...current, postedDate: event.target.value }))}
                      required
                    />
                  </label>

                  <label className="full-width">
                    Remittance Reference (optional)
                    <input
                      type="text"
                      value={paymentForm.remittanceRef}
                      onChange={(event) => setPaymentForm((current) => ({ ...current, remittanceRef: event.target.value }))}
                      placeholder="e.g. RMT482910 (auto-generated if blank)"
                    />
                  </label>
                </div>

                <div className="claim-form-actions">
                  <button type="button" className="secondary-button" onClick={() => setShowCreatePayment(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Post Payment</button>
                </div>
              </form>
            </div>
          </div>
        )}
        </div>
      </PageShell>
    </>
  )
}
