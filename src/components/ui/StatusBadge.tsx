'use client'

interface StatusBadgeProps {
  status: 'draft' | 'in_review' | 'finalized'
}

const statusConfig = {
  draft: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: '📝',
  },
  in_review: {
    label: 'In Review',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: '🔍',
  },
  finalized: {
    label: 'Finalized',
    className: 'bg-green-50 text-green-700 border-green-200',
    icon: '✅',
  },
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${config.className}`}
      role="status"
      aria-label={`Document status: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  )
}
