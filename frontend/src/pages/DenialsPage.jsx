import { useState } from 'react'
import { useRcm, CLAIM_STATUSES, paginate } from '../context/RcmContext'
import PageShell from '../components/PageShell'
import '../App.css'

export default function DenialsPage() {
  const {
    claims,
    denials,
    denialForm, setDenialForm,
    showCreateDenial, setShowCreateDenial,
    showEditDenial, setShowEditDenial,
    editingDenialId,
    openEditDenial, handleCreateDenial, handleEditDenial, handleDeleteDenial,
    loadDenials,
    showToast, toasts,
  } = useRcm()

  const [denialPage, setDenialPage] = useState(1)
  const claimIds = new Set(claims.map((claim) => String(claim.claimId || claim.id)))
  const visibleDenials = claimIds.size === 0 ? [] : denials.filter((denial) => claimIds.has(String(denial.claimId || '')))
  const denialPageSize = 10
  const { items: paginatedDenials, currentPage: denialCurrentPage, totalPages: denialTotalPages, hasPrev: denialHasPrev, hasNext: denialHasNext } = paginate(visibleDenials, denialPage, denialPageSize)
  const topDenialCodes = Object.values(
    visibleDenials.reduce((accumulator, denial) => {
      const key = denial.code || 'Unknown'
      const item = accumulator[key] || { code: key, count: 0, amount: 0 }
      item.count += 1
      item.amount += Number(denial.amount || 0)
      accumulator[key] = item
      return accumulator
    }, {})
  ).sort((first, second) => second.amount - first.amount).slice(0, 4)

  return (
    <>
      <PageShell title="Denials" subtitle="Track and manage claim denials">
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>

        <div className="denials-view">
          <div className="claims-header-row">
            <div>
              <h2>Denials</h2>
              <p>Track and manage claim denials</p>
            </div>
            <div className="claims-actions">
              <button type="button" className="primary-button claims-create-button" onClick={() => setShowCreateDenial(true)}>＋ New Denial</button>
            </div>
          </div>

        <div className="denials-layout">
          <div className="denials-table-card">
            <div className="panel-header">
              <h3>Denial List</h3>
            </div>
            <div className="claims-table-wrap">
              {visibleDenials.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.25rem', borderRadius: '12px', background: '#f5f7fb', color: '#58667a', textAlign: 'center' }}>
                  No denials exist for the current claim set.
                </div>
              ) : (
                <table className="claims-table">
                  <thead>
                    <tr>
                      <th>Denial ID</th>
                      <th>Claim ID</th>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Denied Amt</th>
                      <th>Date</th>
                      <th>Root Cause</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDenials.map((denial) => (
                      <tr key={denial.id || denial.denialId}>
                        <td>{denial.denialId || denial.id}</td>
                        <td>{denial.claimId}</td>
                        <td>{denial.code}</td>
                        <td>{denial.description}</td>
                        <td>${Number(denial.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>{denial.deniedDate}</td>
                        <td>{denial.rootCause}</td>
                        <td><span className={`status ${String(denial.status).toLowerCase().replace(/\s+/g, '-')}`}>{denial.status}</span></td>
                        <td className="table-actions">
                          <button type="button" className="icon-button" onClick={() => openEditDenial(denial)}>✎</button>
                          <button type="button" className="icon-button danger" onClick={() => handleDeleteDenial(denial.id)}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}

                {visibleDenials.length > denialPageSize && (
                  <div className="pagination-bar">
                    <button
                      type="button"
                      className="pagination-button"
                      disabled={!denialHasPrev}
                      onClick={() => setDenialPage(denialCurrentPage - 1)}
                    >
                      ← Prev
                    </button>
                    <span className="pagination-info">Page {denialCurrentPage} of {denialTotalPages}</span>
                    <button
                      type="button"
                      className="pagination-button"
                      disabled={!denialHasNext}
                      onClick={() => setDenialPage(denialCurrentPage + 1)}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
          </div>

          <div className="denials-insights-card">
            <div className="panel-header">
              <h3>Top Denial Codes</h3>
            </div>
            <div className="denial-codes-list">
              {topDenialCodes.map((code, index) => (
                <div key={code.code} className="denial-code-item">
                  <div className="denial-rank">{index + 1}</div>
                  <div className="denial-code-meta">
                    <strong>{code.code}</strong>
                    <small>{code.count} denials</small>
                  </div>
                  <div className="denial-code-amount">${Number(code.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              ))}
            </div>
          </div>

          {showCreateDenial && (
            <div className="claim-modal-backdrop" onClick={() => setShowCreateDenial(false)}>
              <div className="claim-modal" onClick={(event) => event.stopPropagation()}>
                <div className="claim-modal-header">
                  <h3>Create Denial</h3>
                  <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowCreateDenial(false)}>×</button>
                </div>

                <form className="claim-form" onSubmit={handleCreateDenial}>
                  <div className="claim-grid">
                    <label>
                      Claim ID
                      <input type="text" value={denialForm.claimId} onChange={(event) => setDenialForm({ ...denialForm, claimId: event.target.value })} required />
                    </label>
                    <label>
                      Denial Code
                      <input type="text" value={denialForm.code} onChange={(event) => setDenialForm({ ...denialForm, code: event.target.value })} required />
                    </label>
                    <label className="full-width">
                      Description
                      <textarea rows="3" value={denialForm.description} onChange={(event) => setDenialForm({ ...denialForm, description: event.target.value })} required />
                    </label>
                    <label>
                      Denied Amount ($)
                      <input type="number" min="0" step="0.01" value={denialForm.amount} onChange={(event) => setDenialForm({ ...denialForm, amount: event.target.value })} required />
                    </label>
                    <label>
                      Date
                      <input type="date" value={denialForm.deniedDate} onChange={(event) => setDenialForm({ ...denialForm, deniedDate: event.target.value })} required />
                    </label>
                    <label>
                      Root Cause
                      <input type="text" value={denialForm.rootCause} onChange={(event) => setDenialForm({ ...denialForm, rootCause: event.target.value })} required />
                    </label>
                    <label>
                      Status
                      <select value={denialForm.status} onChange={(event) => setDenialForm({ ...denialForm, status: event.target.value })}>
                        <option value="Open">Open</option>
                        <option value="In Review">In Review</option>
                        <option value="Appealed">Appealed</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </label>
                  </div>

                  <div className="claim-form-actions">
                    <button type="button" className="secondary-button" onClick={() => setShowCreateDenial(false)}>Cancel</button>
                    <button type="submit" className="primary-button">Create Denial</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showEditDenial && (
            <div className="claim-modal-backdrop" onClick={() => setShowEditDenial(false)}>
              <div className="claim-modal" onClick={(event) => event.stopPropagation()}>
                <div className="claim-modal-header">
                  <h3>Edit Denial</h3>
                  <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowEditDenial(false)}>×</button>
                </div>

                <form className="claim-form" onSubmit={handleEditDenial}>
                  <div className="claim-grid">
                    <label>
                      Claim ID
                      <input type="text" value={denialForm.claimId} onChange={(event) => setDenialForm({ ...denialForm, claimId: event.target.value })} required />
                    </label>
                    <label>
                      Denial Code
                      <input type="text" value={denialForm.code} onChange={(event) => setDenialForm({ ...denialForm, code: event.target.value })} required />
                    </label>
                    <label className="full-width">
                      Description
                      <textarea rows="3" value={denialForm.description} onChange={(event) => setDenialForm({ ...denialForm, description: event.target.value })} required />
                    </label>
                    <label>
                      Denied Amount ($)
                      <input type="number" min="0" step="0.01" value={denialForm.amount} onChange={(event) => setDenialForm({ ...denialForm, amount: event.target.value })} required />
                    </label>
                    <label>
                      Date
                      <input type="date" value={denialForm.deniedDate} onChange={(event) => setDenialForm({ ...denialForm, deniedDate: event.target.value })} required />
                    </label>
                    <label>
                      Root Cause
                      <input type="text" value={denialForm.rootCause} onChange={(event) => setDenialForm({ ...denialForm, rootCause: event.target.value })} required />
                    </label>
                    <label>
                      Status
                      <select value={denialForm.status} onChange={(event) => setDenialForm({ ...denialForm, status: event.target.value })}>
                        <option value="Open">Open</option>
                        <option value="In Review">In Review</option>
                        <option value="Appealed">Appealed</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </label>
                  </div>

                  <div className="claim-form-actions">
                    <button type="button" className="secondary-button" onClick={() => setShowEditDenial(false)}>Cancel</button>
                    <button type="submit" className="primary-button">Save Changes</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
      </PageShell>
    </>
  )
}
