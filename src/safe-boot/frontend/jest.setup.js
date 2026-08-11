/**
 * Jest setup — registers @testing-library/react-native v12 built-in
 * matchers (toBeOnTheScreen, toBeVisible, ...) used by the reporting
 * component tests.
 *
 * @note @testing-library/jest-native is deprecated and no longer ships
 * toBeInTheDocument; RNTL v12's equivalent is toBeOnTheScreen.
 */
import '@testing-library/react-native/extend-expect';
