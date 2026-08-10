/**
 * Jest — matchers étendus pour les tests React Native (RNTL v12).
 *
 * @testing-library/react-native v12 fournit toBeOnTheScreen, toBeVisible…
 * via `@testing-library/react-native/extend-expect`. L'import ci-dessous
 * rend les types disponibles globalement pour les specs, sans import par
 * fichier ; la déclaration explicite couvre le cas où l'augmentation
 * fournie par le paquet n'est pas résolue.
 */
import '@testing-library/react-native/extend-expect';

declare global {
  namespace jest {
    interface Matchers<R, T = {}> {
      /** Matcher RNTL v12 — équivalent moderne de toBeInTheDocument (web). */
      toBeOnTheScreen(): R;
    }
  }
}

export {};
