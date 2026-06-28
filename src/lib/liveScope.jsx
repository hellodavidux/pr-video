import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  memo,
  createContext,
} from 'react'
import * as LucideIcons from 'lucide-react'

const box = (extra = {}) => ({
  background: '#1a1d24',
  border: '1px solid #2e3138',
  borderRadius: 10,
  padding: 16,
  color: '#e8eaed',
  ...extra,
})

const cn = (...args) => args.flat().filter(Boolean).join(' ')

const styled = new Proxy(
  (tag) => (props) => React.createElement(tag, props, props?.children),
  {
    get: (_, tag) => (props) => React.createElement(tag, props, props?.children),
  }
)

const motion = new Proxy(
  {},
  {
    get: (_, tag) => ({ children, ...props }) =>
      React.createElement(tag, props, children),
  }
)

export const liveScope = {
  React,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useContext,
  useLayoutEffect: React.useLayoutEffect,
  useId: React.useId,
  Fragment: React.Fragment,
  Children: React.Children,
  forwardRef,
  memo,
  createContext,
  cn,
  clsx: cn,
  classNames: cn,
  twMerge: cn,
  styled,
  motion,
  ...LucideIcons,

  Button: ({ children, className, ...props }) => (
    <button
      className={className}
      style={{
        background: '#534ab7',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        padding: '10px 16px',
        fontWeight: 500,
        cursor: 'pointer',
      }}
      {...props}
    >
      {children}
    </button>
  ),
  Card: ({ children, title, className }) => (
    <div className={className} style={box({ width: '100%' })}>
      {title && <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>}
      {children}
    </div>
  ),
  Input: (props) => (
    <input
      style={{
        width: '100%',
        padding: '10px 12px',
        background: '#0d0f12',
        border: '1px solid #2e3138',
        borderRadius: 8,
        color: '#e8eaed',
      }}
      {...props}
    />
  ),
  Badge: ({ children }) => (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        background: 'rgba(127,119,221,0.2)',
        color: '#afa9ec',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  ),
  Icon: () => (
    <span
      style={{
        display: 'inline-block',
        width: 20,
        height: 20,
        borderRadius: 6,
        background: 'linear-gradient(135deg, #534ab7, #7f77dd)',
      }}
    />
  ),
  Container: ({ children }) => <div style={{ width: '100%' }}>{children}</div>,
  Stack: ({ children, gap = 12 }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>{children}</div>
  ),
  Row: ({ children, gap = 12 }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>{children}</div>
  ),
  Text: ({ children, muted }) => (
    <p style={{ color: muted ? 'rgba(255,255,255,0.6)' : '#e8eaed', lineHeight: 1.5 }}>
      {children}
    </p>
  ),
  Heading: ({ children }) => (
    <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>{children}</h2>
  ),
  Label: ({ children }) => (
    <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 6 }}>
      {children}
    </label>
  ),
  Link: ({ children, href = '#' }) => (
    <a href={href} style={{ color: '#afa9ec', textDecoration: 'none' }}>{children}</a>
  ),
  Div: ({ children, style, className, ...props }) => (
    <div className={className} style={style} {...props}>{children}</div>
  ),
  Box: ({ children, style }) => <div style={{ ...box(), ...style }}>{children}</div>,
  Flex: ({ children, gap = 12, direction = 'column' }) => (
    <div style={{ display: 'flex', flexDirection: direction, gap }}>{children}</div>
  ),
  Grid: ({ children, columns = 2, gap = 12 }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap }}>
      {children}
    </div>
  ),
  Spinner: () => (
    <div
      style={{
        width: 24,
        height: 24,
        border: '3px solid rgba(127,119,221,0.3)',
        borderTopColor: '#7f77dd',
        borderRadius: '50%',
      }}
    />
  ),
  Avatar: ({ name }) => (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #534ab7, #7f77dd)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  ),
  Tag: ({ children }) => (
    <span
      style={{
        padding: '4px 8px',
        borderRadius: 6,
        background: '#1a1d24',
        border: '1px solid #2e3138',
        fontSize: 12,
        color: '#afa9ec',
      }}
    >
      {children}
    </span>
  ),
  Divider: () => <hr style={{ border: 'none', borderTop: '1px solid #2e3138', margin: '12px 0' }} />,
}
