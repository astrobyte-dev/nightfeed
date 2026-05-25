import { NSFW_DIRECTORY } from '../utils/nsfwDirectory';

function CategoryPillRow({ activeCategory, onSelectCategory }) {
  return (
    <div className="pill-row pill-row-categories">
      {NSFW_DIRECTORY.map((section) => (
        <button
          key={section.category}
          type="button"
          className={`category-pill ${activeCategory === section.category ? 'active' : ''}`}
          onClick={() => onSelectCategory(section.category, section.items)}
        >
          {section.category}
        </button>
      ))}
    </div>
  );
}

export default CategoryPillRow;
