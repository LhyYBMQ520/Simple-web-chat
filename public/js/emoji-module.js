/**
 * Emoji Picker Module
 * Provides the emoji picker popup with search and category navigation.
 * Insert selected emoji at cursor position in the message textarea.
 */

(function initEmojiModule(global) {
  "use strict";

  function createEmojiModule(options) {
    var emojiData = options.emojiData;
    if (!emojiData) {
      throw new Error("EmojiModule requires emojiData");
    }

    var container = null;
    var searchInput = null;
    var emojiGrid = null;
    var activeCategory = null;
    var isVisible = false;
    var onInsertEmoji = options.onInsertEmoji || function () {};

    /** Build the entire emoji picker DOM */
    function createPickerDOM() {
      var wrapper = document.createElement("div");
      wrapper.className = "emoji-picker";
      wrapper.style.display = "none";

      // -- Search bar --
      var searchBar = document.createElement("div");
      searchBar.className = "emoji-search-bar";

      var searchIcon = document.createElement("i");
      searchIcon.className = "fa-solid fa-magnifying-glass emoji-search-icon";

      searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.className = "emoji-search-input";
      searchInput.placeholder = "搜索表情...";
      searchInput.autocomplete = "off";

      searchBar.appendChild(searchIcon);
      searchBar.appendChild(searchInput);
      wrapper.appendChild(searchBar);

      // -- Category tabs --
      var tabs = document.createElement("div");
      tabs.className = "emoji-category-tabs";

      var categories = emojiData.categories;
      categories.forEach(function (cat, idx) {
        var tab = document.createElement("button");
        tab.type = "button";
        tab.className = "emoji-category-tab";
        tab.title = cat.name;
        tab.innerHTML = '<span class="emoji-cat-char">' + cat.char + '</span>';
        tab.dataset.categoryKey = cat.key;
        tab.addEventListener("click", function () {
          showCategory(cat.key);
          if (searchInput) searchInput.value = "";
        });
        if (idx === 0) {
          tab.classList.add("active");
        }
        tabs.appendChild(tab);
      });
      wrapper.appendChild(tabs);

      // -- Emoji scroll area --
      var scrollArea = document.createElement("div");
      scrollArea.className = "emoji-scroll-area";

      // Results header (hidden by default, shown during search)
      var resultHeader = document.createElement("div");
      resultHeader.className = "emoji-result-header";
      resultHeader.style.display = "none";
      scrollArea.appendChild(resultHeader);

      // Category content area
      var categoryContent = document.createElement("div");
      categoryContent.className = "emoji-category-content";
      scrollArea.appendChild(categoryContent);

      // Emoji grid
      emojiGrid = document.createElement("div");
      emojiGrid.className = "emoji-grid";
      scrollArea.appendChild(emojiGrid);

      wrapper.appendChild(scrollArea);

      // Search handling
      var searchTimer = null;
      searchInput.addEventListener("input", function () {
        clearTimeout(searchTimer);
        var query = searchInput.value.trim();
        if (query.length === 0) {
          // Clear search, show current category
          hideResultHeader();
          if (activeCategory) {
            showCategoryGrid(activeCategory);
          } else {
            showCategoryGridByKey(categories[0].key);
          }
          return;
        }

        searchTimer = setTimeout(function () {
          performSearch(query);
        }, 150);
      });

      // Initial state: show first category as frequently used
      renderFrequentEmojis();
      activeCategory = "__frequent__";

      // Prevent clicks inside picker from closing it
      wrapper.addEventListener("click", function (e) {
        e.stopPropagation();
      });

      return wrapper;
    }

    function hideResultHeader() {
      var header = container.querySelector(".emoji-result-header");
      if (header) header.style.display = "none";
    }

    function showResultHeader(count) {
      var header = container.querySelector(".emoji-result-header");
      if (header) {
        header.style.display = "block";
        header.textContent = "搜索结果 (" + count + "个)";
      }
    }

    function performSearch(query) {
      var results = emojiData.searchEmojis(query);
      showResultHeader(results.length);
      renderEmojiGrid(results);
    }

    function renderFrequentEmojis() {
      var frequent = emojiData.getFrequentEmojis();
      renderEmojiGrid(frequent);
    }

    /** Render a flat emoji array into the grid */
    function renderEmojiGrid(emojiList) {
      if (!emojiGrid) return;
      emojiGrid.innerHTML = "";

      if (emojiList.length === 0) {
        var empty = document.createElement("div");
        empty.className = "emoji-empty";
        empty.textContent = "没有找到匹配的表情";
        emojiGrid.appendChild(empty);
        return;
      }

      emojiList.forEach(function (emoji) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "emoji-item";
        btn.title = emoji.name;
        btn.textContent = emoji.char;
        btn.addEventListener("click", function () {
          onInsertEmoji(emoji.char);
        });
        emojiGrid.appendChild(btn);
      });
    }

    /** Show a specific category by key */
    function showCategory(categoryKey) {
      hideResultHeader();
      showCategoryGridByKey(categoryKey);
      updateActiveTab(categoryKey);
    }

    function showCategoryGridByKey(categoryKey) {
      if (!emojiGrid) return;

      if (categoryKey === "__frequent__") {
        activeCategory = "__frequent__";
        renderFrequentEmojis();
        return;
      }

      // Find category and render its subcategory sections
      var categories = emojiData.categories;
      var cat = null;
      for (var i = 0; i < categories.length; i++) {
        if (categories[i].key === categoryKey) {
          cat = categories[i];
          break;
        }
      }
      if (!cat) return;
      activeCategory = categoryKey;

      emojiGrid.innerHTML = "";

      (cat.subcategories || []).forEach(function (sub) {
        var section = document.createElement("div");
        section.className = "emoji-section";

        var header = document.createElement("div");
        header.className = "emoji-section-header";
        header.textContent = sub.name;
        section.appendChild(header);

        var row = document.createElement("div");
        row.className = "emoji-section-row";

        (sub.emojis || []).forEach(function (emoji) {
          if (emoji.isCategory) return;
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "emoji-item";
          btn.title = emoji.name;
          btn.textContent = emoji.char;
          btn.addEventListener("click", function () {
            onInsertEmoji(emoji.char);
          });
          row.appendChild(btn);
        });

        section.appendChild(row);
        emojiGrid.appendChild(section);
      });
    }

    function updateActiveTab(categoryKey) {
      var tabs = container.querySelectorAll(".emoji-category-tab");
      tabs.forEach(function (tab) {
        if (tab.dataset.categoryKey === categoryKey) {
          tab.classList.add("active");
        } else {
          tab.classList.remove("active");
        }
      });
    }

    /** Show the picker relative to a trigger element */
    function show(triggerEl) {
      if (!container) {
        container = createPickerDOM();
        document.body.appendChild(container);
      }

      if (isVisible && container.style.display !== "none") {
        hide();
        return;
      }

      // Position the picker above the input bar, right-aligned
      var rect = triggerEl.getBoundingClientRect();
      var pickerWidth = 340;
      var pickerHeight = 380;

      // Right-align with the trigger element
      var left = Math.min(rect.right - pickerWidth, window.innerWidth - pickerWidth - 8);
      left = Math.max(left, 8);
      var top = rect.top - pickerHeight - 8;

      // If not enough space above, show below
      if (top < 8) {
        top = rect.bottom + 8;
      }

      container.style.left = left + "px";
      container.style.top = top + "px";
      container.style.display = "";
      isVisible = true;

      // Focus search
      if (searchInput) {
        setTimeout(function () {
          searchInput.focus();
        }, 50);
      }

      // If showing frequently used, re-render
      if (activeCategory === "__frequent__") {
        renderFrequentEmojis();
      }
    }

    function hide() {
      if (container) {
        container.style.display = "none";
      }
      isVisible = false;
    }

    /** Close picker on outside click */
    function handleDocumentClick(e) {
      if (!isVisible || !container) return;
      if (!container.contains(e.target)) {
        hide();
      }
    }

    document.addEventListener("click", handleDocumentClick, true);

    /** Close on Escape */
    function handleKeyDown(e) {
      if (e.key === "Escape" && isVisible) {
        hide();
      }
    }
    document.addEventListener("keydown", handleKeyDown);

    return {
      show: show,
      hide: hide,
      isVisible: function () {
        return isVisible;
      }
    };
  }

  global.ChatEmojiModule = {
    createEmojiModule: createEmojiModule
  };
})(window);
