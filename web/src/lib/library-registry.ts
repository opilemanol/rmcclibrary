import type { LibraryId } from "./types";

export const LIBRARIES: Array<{
  id: LibraryId;
  name: string;
  shortDescription: string;
  description: string;
  dataFile: string;
  icon: string;
  collection: string;
  capacity: string;
}> = [
  { id: "sunday-school", name: "Sunday School", shortDescription: "Weekly lessons for growing in faith.", description: "Weekly lessons for group and personal study.", dataFile: "sunday-school.json", icon: "book-open", collection: "lessons", capacity: "52 lessons" },
  { id: "daily-devotionals", name: "Daily Devotional", shortDescription: "A daily moment for reflection.", description: "Daily scripture, reflection and practical encouragement.", dataFile: "daily-devotionals.json", icon: "sun", collection: "devotionals", capacity: "365 days" },
  { id: "family-devotionals", name: "Family Devotional", shortDescription: "Faith resources for the whole family.", description: "Daily scripture readings, discussion and activities for families.", dataFile: "family-devotionals.json", icon: "house", collection: "devotionals", capacity: "365 days" },
  { id: "reports-forms", name: "Reports & Forms", shortDescription: "Church forms and reporting templates.", description: "Fill, save and share church forms on this device.", dataFile: "reports-forms.json", icon: "clipboard-list", collection: "forms", capacity: "17 forms" },
  { id: "sunday-sermons", name: "Sunday Sermons", shortDescription: "Weekly sermon outlines and notes.", description: "Weekly sermon outlines for reading and reflection.", dataFile: "sunday-sermons.json", icon: "mic-2", collection: "sermons", capacity: "52 sermons" },
  { id: "bible-study", name: "Bible Study", shortDescription: "Explore scripture in greater depth.", description: "Weekly studies, questions and lessons learned.", dataFile: "bible-study.json", icon: "book-marked", collection: "studies", capacity: "52 studies" },
  { id: "prayer-guides", name: "Prayer Guides", shortDescription: "Weekly themes to guide prayer.", description: "Prayer points and declarations for each programme week.", dataFile: "prayer-guides.json", icon: "hands-praying", collection: "prayerGuides", capacity: "52 guides" },
  { id: "baptismal-course", name: "Baptismal Course", shortDescription: "Prepare for water baptism.", description: "Course modules and lessons for baptismal training.", dataFile: "baptismal-course.json", icon: "waves", collection: "modules", capacity: "Course modules" },
  { id: "discipleship-course", name: "Discipleship Course", shortDescription: "Resources for a life of discipleship.", description: "Course modules, discussion and assignments.", dataFile: "discipleship-course.json", icon: "users-round", collection: "modules", capacity: "Course modules" },
];
