import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customers } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { CHANNEL } from '@/lib/badges';
import { downloadCsv } from '@/lib/csv';
import { fD, inr, plural, waLink, ymd } from '@/lib/format';
import { useUi } from '@/store/useUi';
import { BLANK_ORDER_FILTERS, useOrderFilters } from '@/features/orders/useOrderFilters';
import f from '@/styles/form.module.css';
import s from './CustomersPage.module.css';
import type { Channel } from '@/data/types';

export function CustomersPage() {
  const navigate = useNavigate();
  const flash = useUi((st) => st.flash);
  const setOrderFilters = useOrderFilters((st) => st.set);

  const [q, setQ] = useState('');
  const [channel, setChannel] = useState<Channel | ''>('');

  const { data: rows = [] } = useQuery({
    queryKey: ['customers', q, channel],
    queryFn: () => customers.list({ q, channel }),
  });

  const exportCsv = () => {
    downloadCsv(`aarunya-customers-${ymd()}.csv`, [
      ['Name', 'Phone', 'Email', 'City', 'Orders', 'Total spent', 'Last order', 'Channels'],
      ...rows.map((m) => [
        m.name,
        m.phone,
        m.email,
        m.city,
        m.orders,
        m.spent,
        fD(m.lastOrderAt),
        m.channels.join(' + '),
      ]),
    ]);
    flash('CSV downloaded');
  };

  const openOrders = (name: string, phone: string) => {
    setOrderFilters({ ...BLANK_ORDER_FILTERS, range: 'all', q: phone || name });
    navigate('/orders');
  };

  return (
    <>
      <PageHeader
        title="Customers"
        sub="Everyone who has ordered online or bought in person."
        actions={[{ label: 'Export CSV', onClick: exportCsv }]}
      />

      <div className={s.screen}>
        <div className={s.bar}>
          <input
            type="search"
            aria-label="Search customers"
            placeholder="Search name, phone, email or city"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={`${f.input} ${s.search}`}
          />
          <select
            aria-label="Channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel | '')}
            className={`${f.select} ${s.channel}`}
          >
            <option value="">Online &amp; offline</option>
            <option value="online">Bought online</option>
            <option value="offline">Bought offline</option>
          </select>
          <span className={s.count}>{plural(rows.length, 'customer')}</span>
        </div>

        <div className={s.card}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 860 }}>
              <div className={s.head}>
                <span>Customer</span>
                <span>City</span>
                <span style={{ textAlign: 'right' }}>Orders</span>
                <span style={{ textAlign: 'right' }}>Spent</span>
                <span>Last order</span>
                <span>Bought</span>
                <span />
              </div>

              {rows.map((m) => (
                <div key={m.key} className={s.row}>
                  <span className={s.person}>
                    <span aria-hidden="true" className={s.avatar}>
                      {(m.name || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className={s.stack}>
                      <span className={s.name}>{m.name || 'Walk-in customer'}</span>
                      <span className={s.contact}>
                        {[m.phone, m.email].filter(Boolean).join(' · ') ||
                          'No contact details'}
                      </span>
                    </span>
                  </span>
                  <span>{m.city || '—'}</span>
                  <span className={s.right}>{m.orders}</span>
                  <span className={s.spent}>{inr(m.spent)}</span>
                  <span className={s.last}>{fD(m.lastOrderAt)}</span>
                  <span className={s.channels}>
                    {m.channels.map((c) => (
                      <span
                        key={c}
                        className={s.pill}
                        style={{ background: CHANNEL[c].bg, color: CHANNEL[c].fg }}
                      >
                        {CHANNEL[c].text}
                      </span>
                    ))}
                  </span>
                  <span className={s.actions}>
                    <button
                      type="button"
                      onClick={() => openOrders(m.name, m.phone)}
                      className={s.ghost}
                    >
                      Orders
                    </button>
                    {m.phone && (
                      <a
                        href={waLink(
                          m.phone,
                          `Hi ${(m.name || '').split(' ')[0]}, this is Veena from Aarunya Jewels.`,
                        )}
                        target="_blank"
                        rel="noopener"
                        className={s.wa}
                      >
                        WhatsApp
                      </a>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {rows.length === 0 && <p className={s.empty}>No customers match.</p>}
        </div>
      </div>
    </>
  );
}
