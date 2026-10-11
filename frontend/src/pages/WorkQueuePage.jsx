import { useState } from 'react'
import { useRcm, buildWorkQueueFromClaims, paginate, formatMoney } from '../context/RcmContext'
import PageShell from '../components/PageShell'
import '../App.css'

export default function WorkQueuePage() {
  const { claims, handleNavigate, toasts } = useRcm()
  const queueItems = buildWorkQueueFromClaims(claims)
  const [selectedQueue, setSelectedQueue] = useState(null)
  const [queuePage, setQueuePage] = useState(1)
  const queuePageSize = 10

  const selectedClaims = selectedQueue ? selectedQueue.claims : []
  const paginated = selectedQueue ? paginate(selectedClaims, queuePage, queuePageSize) : { items: [], currentPage: 0, totalPages: 0, hasPrev: false, hasNext: false }

  const priorityClass = (priority) => {
    const lower = String(priority).toLowerCase()
    if (lower === 'medium') return 'priority-medium'
    if (lower === 'high') return 'priority-high'
    if (lower === 'critical') return 'priority-critical'
    return ''
  }

  return (
    <>
      <PageShell title="Work Queues" subtitle="Prioritized claim work queues for AR operations">
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
              <h2>Work Queues</h2>
              <p>Claim work items grouped by current status</p>
            </div>
            <div className="claims-actions">
              <button type="button" className="secondary-button" onClick={() => handleNavigate('claims')}>Open claims</button>
            </div>
          </div>

          <div className="queue-layout">
            <div className="queue-list">
              <h4 className="queue-section-title">Queues</h4>
              <div className="queue-grid">
                {queueItems.map((queue) => {
                  const total = Number(queue.amount || 0)
                  const isZero = queue.count === 0

                  return (
                    <div
                      key={queue.key}
                      className={`queue-card ${isZero ? 'queue-empty' : ''} ${priorityClass(queue.priority)}`}
                      onClick={() => {
                        if (!isZero) {
                          setSelectedQueue(queue)
                          setQueuePage(1)
                        }
                      }}
                      style={{ cursor: isZero ? 'default' : 'pointer' }}
                    >
                      <div className="queue-card-header">
                        <span className="queue-name">{queue.label}</span>
                        <span className={`priority-tag ${priorityClass(queue.priority)}`}>{queue.priority}</span>
                      </div>
                      <div className="queue-card-body">
                        <div className="queue-count">{queue.count} claim{queue.count !== 1 ? 's' : ''}</div>
                        <div className="queue-amount">{formatMoney(total)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="queue-detail-panel">
              {!selectedQueue ? (
                <div className="queue-placeholder">
                  Select a Work Queue — Click on a queue from the left to view and manage its claims.
                </div>
              ) : (
                <>
                  <div className="queue-detail-header">
                    <h3>{selectedQueue.label}</h3>
                    <span className={`priority-tag ${priorityClass(selectedQueue.priority)}`}>{selectedQueue.priority}</span>
                  </div>

                  <div className="claims-table-wrap">
                    {paginated.items.length === 0 ? (
                      <div className="empty-state">
                        No claims in this queue.
                      </div>
                    ) : (
                      <table className="claims-table">
                        <thead>
                          <tr>
                            <th>Claim ID</th>
                            <th>Patient</th>
                            <th>Payer</th>
                            <th>Balance</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginated.items.map((claim) => (
                            <tr key={claim.id || claim.claimId}>
                              <td>{claim.claimId || claim.id}</td>
                              <td>{claim.patient}</td>
                              <td>{claim.payer}</td>
                              <td>${Number(claim.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td><span className={`status ${String(claim.status).toLowerCase()}`}>{claim.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {selectedClaims.length > queuePageSize && (
                    <div className="pagination-bar">
                      <button
                        type="button"
                        className="pagination-button"
                        disabled={!paginated.hasPrev}
                        onClick={() => setQueuePage(paginated.currentPage - 1)}
                      >
                        ← Prev
                      </button>
                      <span className="pagination-info">Page {paginated.currentPage} of {paginated.totalPages}</span>
                      <button
                        type="button"
                        className="pagination-button"
                        disabled={!paginated.hasNext}
                        onClick={() => setQueuePage(paginated.currentPage + 1)}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </PageShell>
    </>
  )
}
