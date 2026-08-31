import React from 'react';
import { Watermark } from 'antd';
import { useAuthStore } from '../../stores/useAuthStore';

export interface AuditorWatermarkProps {
  children: React.ReactNode;
}

export const AuditorWatermark: React.FC<AuditorWatermarkProps> = ({ children }) => {
  const { user } = useAuthStore();
  const isAuditor = user?.activeRole === 'AUDITOR';

  if (!isAuditor) {
    return <>{children}</>;
  }

  return (
    <Watermark
      content={['NUSAPROC AUDIT SANDBOX', 'READ-ONLY ACCESS (R54)', user?.fullName || 'AUDITOR']}
      font={{ color: 'rgba(235, 47, 150, 0.12)', fontSize: 15 }}
      gap={[120, 120]}
      style={{ minHeight: '100%' }}
    >
      {children}
    </Watermark>
  );
};

export default AuditorWatermark;
