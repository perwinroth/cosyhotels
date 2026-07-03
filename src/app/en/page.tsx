// /en is the same English homepage as "/". Re-export the component AND metadata so /en carries an
// explicit canonical → "/" (consolidating the duplicate). Without a metadata export it inherited
// none and Google flagged it "duplicate without user-selected canonical".
export { default, metadata } from '../page';
