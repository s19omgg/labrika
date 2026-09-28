import MaskoMascot from './MaskoMascot';

export default function HeroMascot() {
  return <div
    className="hero-mascot-animation"
    role="img"
    aria-label="Маскот LABRICA"
    data-mascot-provider="masko"
  >
    <MaskoMascot animation="Plush Swagger" className="hero-masko-mascot"/>
  </div>;
}
