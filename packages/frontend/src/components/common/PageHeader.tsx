import React from 'react';
import { Card, Row, Col, Typography, Space, Breadcrumb, theme } from 'antd';

const { Title, Text } = Typography;

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  tags?: React.ReactNode;
  extra?: React.ReactNode;
  breadcrumbs?: Array<{ title: React.ReactNode; href?: string }>;
  style?: React.CSSProperties;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  tags,
  extra,
  breadcrumbs,
  style,
}) => {
  const { token } = theme.useToken();

  return (
    <Card
      style={{
        marginBottom: 24,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
        ...style,
      }}
      bodyStyle={{ padding: '20px 24px' }}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Breadcrumb items={breadcrumbs} />
        </div>
      )}
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col xs={24} md={extra ? 16 : 24}>
          <Space align="start" size="middle">
            {icon && (
              <div
                style={{
                  fontSize: 26,
                  color: token.colorPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  marginTop: 2,
                }}
              >
                {icon}
              </div>
            )}
            <div>
              <Space align="center" wrap size={8}>
                <Title level={4} style={{ margin: 0, fontWeight: 600, color: token.colorTextHeading }}>
                  {title}
                </Title>
                {tags}
              </Space>
              {subtitle && (
                <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 13 }}>
                  {subtitle}
                </Text>
              )}
            </div>
          </Space>
        </Col>
        {extra && (
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Space wrap size="small">
              {extra}
            </Space>
          </Col>
        )}
      </Row>
    </Card>
  );
};

export default PageHeader;
