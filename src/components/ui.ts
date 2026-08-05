import { styled } from "@linaria/react";
import { theme } from "../styles/theme";

export const Panel = styled.section`
  overflow: hidden;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.lg};
  background: color-mix(in srgb, ${theme.colors.surface} 93%, transparent);
  box-shadow: ${theme.shadows.card}, ${theme.shadows.inset};
  backdrop-filter: blur(16px);
`;

export const PanelHeader = styled.header`
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 20px;
  border-bottom: 1px solid ${theme.colors.border};
`;

export const PanelHeading = styled.div`
  min-width: 0;
`;

export const PanelTitle = styled.h2`
  margin: 0;
  color: ${theme.colors.textPrimary};
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.01em;
`;

export const PanelDescription = styled.p`
  margin: 3px 0 0;
  color: ${theme.colors.textMuted};
  font-size: 10px;
`;

export const SubtleButton = styled.button`
  display: inline-flex;
  height: 34px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.sm};
  background: ${theme.colors.surfaceMuted};
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  font-weight: 700;
  transition: all ${theme.motion.fast};

  &:hover {
    border-color: ${theme.colors.borderStrong};
    background: ${theme.colors.surface};
    color: ${theme.colors.brand};
  }
`;

export const EyebrowBadge = styled.span`
  display: inline-flex;
  height: 25px;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, ${theme.colors.brand} 12%, transparent);
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.brandSubtle};
  color: ${theme.colors.brandDeep};
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.04em;
`;
