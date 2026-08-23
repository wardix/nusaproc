import React from 'react';
import { Space, Tag, Avatar, Tooltip } from 'antd';
import { DEMO_PERSONAS, type DemoPersona } from '@nusaproc/shared';
import { useAuthStore } from '../../stores/useAuthStore';

export const DemoPersonaBar: React.FC = () => {
  const { user, setUser } = useAuthStore();

  const handleSelectPersona = (persona: DemoPersona) => {
    setUser({
      id: persona.id,
      email: persona.email,
      fullName: persona.fullName,
      employeeId: persona.employeeId,
      divisionId: persona.divisionId,
      branchId: persona.branchId,
      roles: [persona.role],
      activeRole: persona.role,
    });
  };

  return (
    <div
      style={{
        background: '#141414',
        color: '#fff',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        fontSize: 12,
        borderBottom: '1px solid #303030',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 600, color: '#faad14' }}>🎭 Fast Persona Switcher:</span>
        <span style={{ color: '#8c8c8c' }}>Click any role to test multi-actor flow</span>
      </div>

      <Space size={[6, 6]} wrap>
        {DEMO_PERSONAS.map((persona) => {
          const isActive = user?.email === persona.email;
          return (
            <Tooltip
              key={persona.id}
              title={`${persona.fullName} (${persona.jobTitle}) - ${persona.divisionId}`}
            >
              <Tag
                onClick={() => handleSelectPersona(persona)}
                style={{
                  cursor: 'pointer',
                  padding: '2px 8px',
                  borderRadius: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginRight: 0,
                  transition: 'all 0.2s',
                  background: isActive ? persona.avatarColor : '#262626',
                  borderColor: isActive ? '#fff' : '#434343',
                  color: '#fff',
                  fontWeight: isActive ? 600 : 400,
                  transform: isActive ? 'scale(1.05)' : 'none',
                  boxShadow: isActive ? '0 0 8px rgba(255,255,255,0.4)' : 'none',
                }}
              >
                <Avatar
                  size={18}
                  style={{
                    backgroundColor: isActive ? '#fff' : persona.avatarColor,
                    color: isActive ? persona.avatarColor : '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {persona.fullName.charAt(0)}
                </Avatar>
                <span>{persona.role}</span>
              </Tag>
            </Tooltip>
          );
        })}
      </Space>
    </div>
  );
};

export default DemoPersonaBar;
