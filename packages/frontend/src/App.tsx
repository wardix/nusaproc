import React from 'react';
import { ConfigProvider, theme, App as AntdApp } from 'antd';
import idID from 'antd/locale/id_ID';
import 'dayjs/locale/id';
import dayjs from 'dayjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { StepUpReauthModal } from './components/security/StepUpReauthModal';

dayjs.locale('id');
const queryClient = new QueryClient();

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={idID}
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#0052CC', // Nusanet Corporate Blue
            colorSuccess: '#389E0D',
            colorWarning: '#D48806',
            colorError: '#CF1322',
            borderRadius: 6,
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          },
          components: {
            Table: {
              headerBg: '#FAFAFA',
              headerColor: '#1F1F1F',
              rowHoverBg: '#F0F5FF',
            },
            Button: {
              controlHeight: 38,
              borderRadius: 6,
            },
          },
        }}
      >
        <AntdApp>
          <RouterProvider router={router} />
          {/* Global Re-Authentication Modal Interceptor (R5, R43) */}
          <StepUpReauthModal />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
