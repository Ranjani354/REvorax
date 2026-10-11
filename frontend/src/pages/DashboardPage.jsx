import { useEffect } from 'react'
import { useRcm, formatMoney } from '../context/RcmContext'
import PageShell from '../components/PageShell'
import '../App.css'

export default function DashboardPage() {
  const {
    claims,
    dashboard,
    toasts,
    refreshAllData,
  } = useRcm()

  return (
    <PageShell title="Dashboard" subtitle="Revenue cycle management overview">
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <section className="stat-grid">
        {dashboard.metrics?.map((metric) => (
          <article key={metric.label} className={`stat-card ${metric.tone}`}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            {metric.trend ? <small>{metric.trend}</small> : null}
          </article>
        ))}
      </section>

      <section className="content-grid">
        <div className="panel">
          <h4>AR aging buckets</h4>
          {dashboard.agingBuckets?.map((bucket) => {
            const amount = Number(bucket.amount || 0)
            const progress = Number(bucket.progress || 0)
            const claimCount = Number(bucket.claimCount || 0)

            return (
              <div key={bucket.label} className="aging-row">
                <div className="aging-info">
                  <span>{bucket.label}</span>
                  <small>{claimCount} claim{claimCount !== 1 ? 's' : ''}</small>
                </div>
                <div className="bar"><div className="fill" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>
                <strong>{formatMoney(amount)}</strong>
              </div>
            )
          })}
        </div>

        <div className="panel">
          <h4>Claims by Status</h4>
          {claims.length === 0 ? (
            <div className="empty-state">
              No claims yet. Create a claim to see the status breakdown.
            </div>
          ) : (
            <div className="status-list">
              {CLAIM_STATUSES_LOCAL.map((status) => {
                const count = claims.filter((claim) => String(claim.status || '').toLowerCase() === status.toLowerCase()).length
                const total = claims.length || 1
                const percent = total ? (count / total) * 100 : 0

                return (
                  <div key={status} className="status-row">
                    <div className="status-label-row">
                      <span>{status}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className="mini-bar-wrap">
                      <div className="mini-bar" style={{ width: `${Math.min(100, percent)}%` }} />
                    </div>
                    <small>{percent.toFixed(1)}% of total</small>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  )
}

const CLAIM_STATUSES_LOCAL = ['Created', 'Submitted', 'Acknowledged', 'In Process', 'Denied', 'Appealed', 'Paid']
