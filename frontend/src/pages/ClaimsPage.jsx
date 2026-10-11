import { useState } from 'react'
import { useRcm, CLAIM_STATUSES, paginate } from '../context/RcmContext'
import PageShell from '../components/PageShell'
import '../App.css'

export default function ClaimsPage() {
  const {
    activeNav, handleNavigate,
    claims, setClaims,
    claimFilters, setClaimFilters,
    showFilterPanel, setShowFilterPanel,
    showCreateClaim, setShowCreateClaim,
    showEditClaim, setShowEditClaim,
    showViewClaim, setShowViewClaim,
    selectedClaim, setSelectedClaim,
    editingClaimId,
    claimForm, setClaimForm,
    openEditClaim, handleCreateClaim, handleEditClaim, handleDeleteClaim,
    openViewClaim, exportClaimsToExcel, importClaimsFromExcel,
    handleApplyClaimFilters, handleResetClaimFilters,
    loadDashboard, loadClaims,
    showToast, toasts,
  } = useRcm()

  const [claimPage, setClaimPage] = useState(1)
  const claimPageSize = 10

  const filteredClaims = claims.filter((claim) => {
    const searchTerm = (claimFilters.search || '').toLowerCase()
    const matchesSearch = !searchTerm
      || String(claim.claimId || claim.id || '').toLowerCase().includes(searchTerm)
      || String(claim.patient || '').toLowerCase().includes(searchTerm)
      || String(claim.payer || '').toLowerCase().includes(searchTerm)
    const matchesStatus = claimFilters.status === 'All Statuses' || String(claim.status || '').toLowerCase() === String(claimFilters.status || '').toLowerCase()
    const matchesPayer = claimFilters.payer === 'All Payers' || claim.payer === claimFilters.payer
    const dosDate = claim.dos
    const matchesFrom = !claimFilters.from || (dosDate && dosDate >= claimFilters.from)
    const matchesTo = !claimFilters.to || (dosDate && dosDate <= claimFilters.to)
    return matchesSearch && matchesStatus && matchesPayer && matchesFrom && matchesTo
  })

  const { items: paginatedClaims, currentPage: claimCurrentPage, totalPages: claimTotalPages, hasPrev: claimHasPrev, hasNext: claimHasNext } = paginate(filteredClaims, claimPage, claimPageSize)

  const handleClaimPageChange = (direction) => {
    if (direction === 'prev' && claimHasPrev) setClaimPage(claimCurrentPage - 1)
    if (direction === 'next' && claimHasNext) setClaimPage(claimCurrentPage + 1)
  }

  const handleClaimFilterApply = () => {
    handleApplyClaimFilters()
    setClaimPage(1)
  }

  const handleClaimFilterReset = () => {
    handleResetClaimFilters()
    setClaimPage(1)
  }

  const renderClaimsView = () => (
    <div className="claims-view">
      <div className="claims-header-row">
        <div>
          <h2>Claims</h2>
          <p>Manage and track all claims</p>
        </div>
        <div className="claims-actions">
          <button type="button" className="filter-button" onClick={() => setShowFilterPanel((current) => !current)}>⌄ Filters</button>
          <button type="button" className="secondary-button" onClick={handleResetClaimFilters}>View all</button>
          <button type="button" className="secondary-button" onClick={exportClaimsToExcel}>Export Excel</button>
          <label className="secondary-button import-button">
            Import Excel
            <input type="file" accept=".xlsx,.xls,.csv" onChange={importClaimsFromExcel} />
          </label>
          <button type="button" className="primary-button claims-create-button" onClick={() => setShowCreateClaim(true)}>＋ New Claim</button>
        </div>
      </div>

      {showFilterPanel && (
        <div className="claims-filter-panel">
          <div className="filter-field">
            <label>Status</label>
            <select value={claimFilters.status} onChange={(event) => {
              const next = { ...claimFilters, status: event.target.value }
              setClaimFilters(next)
            }}>
              <option>All Statuses</option>
              {CLAIM_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label>Payer</label>
            <select value={claimFilters.payer} onChange={(event) => {
              const next = { ...claimFilters, payer: event.target.value }
              setClaimFilters(next)
            }}>
              <option>All Payers</option>
              <option>UnitedHealthcare</option>
              <option>Blue Cross</option>
              <option>Aetna</option>
              <option>Cigna</option>
            </select>
          </div>
          <div className="filter-field">
            <label>Date From</label>
            <input type="date" value={claimFilters.from} onChange={(event) => {
              const next = { ...claimFilters, from: event.target.value }
              setClaimFilters(next)
            }} />
          </div>
          <div className="filter-field">
            <label>Date To</label>
            <input type="date" value={claimFilters.to} onChange={(event) => {
              const next = { ...claimFilters, to: event.target.value }
              setClaimFilters(next)
            }} />
          </div>
          <div className="filter-field" style={{ gridColumn: '1 / -1' }}>
            <label>Search</label>
            <input type="text" placeholder="Search claims..." value={claimFilters.search} onChange={(event) => {
              const next = { ...claimFilters, search: event.target.value }
              setClaimFilters(next)
            }} />
          </div>
          <div className="filter-actions" style={{ gridColumn: '1 / -1' }}>
            <button type="button" className="secondary-button" onClick={handleClaimFilterReset}>Reset</button>
            <button type="button" className="primary-button" onClick={handleClaimFilterApply}>Apply filters</button>
          </div>
        </div>
      )}

      <div className="claims-table-wrap">
        <table className="claims-table">
          <thead>
            <tr>
              <th>Claim ID</th>
              <th>Patient</th>
              <th>Provider</th>
              <th>Payer</th>
              <th>DOS</th>
              <th>Charged</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedClaims.map((claim) => (
              <tr key={claim.id || claim.claimId}>
                <td>{claim.claimId || claim.id}</td>
                <td>{claim.patient}</td>
                <td>{claim.provider}</td>
                <td>{claim.payer}</td>
                <td>{claim.dos}</td>
                <td>${Number(claim.charged || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>${Number(claim.paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>${Number(claim.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td><span className={`status ${String(claim.status).toLowerCase()}`}>{claim.status}</span></td>
                <td className="table-actions">
                  <button type="button" className="icon-button" onClick={() => openViewClaim(claim)}>👁</button>
                  <button type="button" className="icon-button" onClick={() => openEditClaim(claim)}>✎</button>
                  <button type="button" className="icon-button danger" onClick={() => handleDeleteClaim(claim.id)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredClaims.length > claimPageSize && (
        <div className="pagination-bar">
          <button
            type="button"
            className="pagination-button"
            disabled={!claimHasPrev}
            onClick={() => handleClaimPageChange('prev')}
          >
            ← Prev
          </button>
          <span className="pagination-info">Page {claimCurrentPage} of {claimTotalPages}</span>
          <button
            type="button"
            className="pagination-button"
            disabled={!claimHasNext}
            onClick={() => handleClaimPageChange('next')}
          >
            Next →
          </button>
        </div>
      )}

      {showViewClaim && selectedClaim && (
        <div className="claim-modal-backdrop" onClick={() => setShowViewClaim(false)}>
          <div className="claim-modal detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="claim-modal-header">
              <h3>Claim {selectedClaim.claimId || selectedClaim.id}</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowViewClaim(false)}>×</button>
            </div>

            <div className="detail-grid">
              <div className="detail-item">
                <span>Patient</span>
                <strong>{selectedClaim.patient}</strong>
              </div>
              <div className="detail-item">
                <span>Provider</span>
                <strong>{selectedClaim.provider}</strong>
              </div>
              <div className="detail-item">
                <span>Payer</span>
                <strong>{selectedClaim.payer}</strong>
              </div>
              <div className="detail-item">
                <span>DOS</span>
                <strong>{selectedClaim.dos}</strong>
              </div>
              <div className="detail-item">
                <span>Charged</span>
                <strong>${Number(selectedClaim.charged || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              <div className="detail-item">
                <span>Paid</span>
                <strong>${Number(selectedClaim.paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              <div className="detail-item">
                <span>Status</span>
                <strong className={`status ${String(selectedClaim.status).toLowerCase()}`}>{selectedClaim.status}</strong>
              </div>
              <div className="detail-item">
                <span>Balance</span>
                <strong>${Number(selectedClaim.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
            </div>

            <div className="claim-form-actions">
              <button type="button" className="secondary-button" onClick={() => setShowViewClaim(false)}>Close</button>
              <button type="button" className="primary-button" onClick={() => { setShowViewClaim(false); openEditClaim(selectedClaim) }}>Edit</button>
            </div>
          </div>
        </div>
      )}

      {showCreateClaim && (
        <div className="claim-modal-backdrop" onClick={() => setShowCreateClaim(false)}>
          <div className="claim-modal" onClick={(event) => event.stopPropagation()}>
            <div className="claim-modal-header">
              <h3>Create New Claim</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowCreateClaim(false)}>×</button>
            </div>

            <form className="claim-form" onSubmit={handleCreateClaim}>
              <div className="claim-grid">
                <label>
                  Patient *
                  <input type="text" value={claimForm.patient} onChange={(event) => setClaimForm({ ...claimForm, patient: event.target.value })} required />
                </label>
                <label>
                  Provider *
                  <input type="text" value={claimForm.provider} onChange={(event) => setClaimForm({ ...claimForm, provider: event.target.value })} required />
                </label>

                <label>
                  Payer *
                  <select value={claimForm.payer} onChange={(event) => setClaimForm({ ...claimForm, payer: event.target.value })}>
                    <option value="UnitedHealthcare">UnitedHealthcare</option>
                    <option value="Blue Cross">Blue Cross</option>
                    <option value="Aetna">Aetna</option>
                    <option value="Cigna">Cigna</option>
                  </select>
                </label>

                <label>
                  Date of Service *
                  <input type="date" value={claimForm.dos} onChange={(event) => setClaimForm({ ...claimForm, dos: event.target.value })} required />
                </label>

                <label>
                  Charge Amount ($) *
                  <input type="number" min="0" step="0.01" value={claimForm.charged} onChange={(event) => {
                    const nextCharged = Number(event.target.value || 0)
                    const nextPaid = Number(claimForm.paid || 0)
                    setClaimForm({ ...claimForm, charged: event.target.value, balance: String((nextCharged - nextPaid).toFixed(2)) })
                  }} required />
                </label>
                <label>
                  Paid Amount ($)
                  <input type="number" min="0" step="0.01" value={claimForm.paid} onChange={(event) => {
                    const nextCharged = Number(claimForm.charged || 0)
                    const nextPaid = Number(event.target.value || 0)
                    setClaimForm({ ...claimForm, paid: event.target.value, balance: String((nextCharged - nextPaid).toFixed(2)) })
                  }} />
                </label>
                <label>
                  Balance ($)
                  <input type="number" min="0" step="0.01" value={claimForm.balance} onChange={(event) => setClaimForm({ ...claimForm, balance: event.target.value })} />
                </label>
              </div>

              <div className="claim-form-actions">
                <button type="button" className="secondary-button" onClick={() => setShowCreateClaim(false)}>Cancel</button>
                <button type="submit" className="primary-button">Create Claim</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditClaim && (
        <div className="claim-modal-backdrop" onClick={() => setShowEditClaim(false)}>
          <div className="claim-modal" onClick={(event) => event.stopPropagation()}>
            <div className="claim-modal-header">
              <h3>Edit Claim</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowEditClaim(false)}>×</button>
            </div>

            <form className="claim-form" onSubmit={handleEditClaim}>
              <div className="claim-grid">
                <label>
                  Patient *
                  <input type="text" value={claimForm.patient} onChange={(event) => setClaimForm({ ...claimForm, patient: event.target.value })} required />
                </label>
                <label>
                  Provider *
                  <input type="text" value={claimForm.provider} onChange={(event) => setClaimForm({ ...claimForm, provider: event.target.value })} required />
                </label>

                <label>
                  Payer *
                  <select value={claimForm.payer} onChange={(event) => setClaimForm({ ...claimForm, payer: event.target.value })}>
                    <option value="UnitedHealthcare">UnitedHealthcare</option>
                    <option value="Blue Cross">Blue Cross</option>
                    <option value="Aetna">Aetna</option>
                    <option value="Cigna">Cigna</option>
                  </select>
                </label>

                <label>
                  Status *
                  <select value={claimForm.status} onChange={(event) => setClaimForm({ ...claimForm, status: event.target.value })}>
                    {CLAIM_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Date of Service *
                  <input type="date" value={claimForm.dos} onChange={(event) => setClaimForm({ ...claimForm, dos: event.target.value })} required />
                </label>

                <label>
                  Charge Amount ($) *
                  <input type="number" min="0" step="0.01" value={claimForm.charged} onChange={(event) => {
                    const nextCharged = Number(event.target.value || 0)
                    const nextPaid = Number(claimForm.paid || 0)
                    setClaimForm({ ...claimForm, charged: event.target.value, balance: String((nextCharged - nextPaid).toFixed(2)) })
                  }} required />
                </label>
                <label>
                  Paid Amount ($)
                  <input type="number" min="0" step="0.01" value={claimForm.paid} onChange={(event) => {
                    const nextCharged = Number(claimForm.charged || 0)
                    const nextPaid = Number(event.target.value || 0)
                    setClaimForm({ ...claimForm, paid: event.target.value, balance: String((nextCharged - nextPaid).toFixed(2)) })
                  }} />
                </label>
                <label>
                  Balance ($)
                  <input type="number" min="0" step="0.01" value={claimForm.balance} onChange={(event) => setClaimForm({ ...claimForm, balance: event.target.value })} />
                </label>
              </div>

              <div className="claim-form-actions">
                <button type="button" className="secondary-button" onClick={() => setShowEditClaim(false)}>Cancel</button>
                <button type="submit" className="primary-button">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      <PageShell title="Claims" subtitle="Manage and track all claims">
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>
        {renderClaimsView()}
      </PageShell>
    </>
  )
}
