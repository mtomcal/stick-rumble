import { describe, test, expect } from 'vitest';
import React from 'react';
import packageJson from '../package.json';

describe('Project Setup', () => {
  test('Phaser is available', () => {
    // Check that Phaser is in dependencies
    expect(packageJson.dependencies).toHaveProperty('phaser');
    expect(packageJson.dependencies.phaser).toMatch(/3\.90/);
  });

  test('React is available', () => {
    expect(React).toBeDefined();
    expect(packageJson.dependencies).toHaveProperty('react');
  });
});
