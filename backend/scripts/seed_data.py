"""Fictional demo data.

Nothing here is real KLE Institute data. Names, policies and numbers are
illustrative and are all editable by an administrator at runtime.
"""

from __future__ import annotations

DEPARTMENTS = [
    ("Bachelor of Computer Applications", "BCA"),
    ("Computer Science & Engineering", "CSE"),
    ("Commerce", "COM"),
    ("Management Studies", "MBA"),
]

# password for every demo account is "Password123"
USERS = [
    ("admin@kle.edu", "System Administrator", "admin", None, "ADM001"),
    ("librarian@kle.edu", "Priya Kulkarni", "librarian", None, "LIB001"),
    ("librarian2@kle.edu", "Rahul Desai", "librarian", None, "LIB002"),
    ("asha@kle.edu", "Asha Nair", "student", "BCA", "BCA2023001"),
    ("vikram@kle.edu", "Vikram Rao", "student", "BCA", "BCA2023002"),
    ("meera@kle.edu", "Meera Joshi", "student", "CSE", "CSE2022014"),
    ("john@kle.edu", "John Mathew", "student", "COM", "COM2023045"),
    ("prof.iyer@kle.edu", "Dr. S. Iyer", "faculty", "BCA", "FAC101"),
    ("prof.rao@kle.edu", "Dr. Lakshmi Rao", "faculty", "CSE", "FAC118"),
]

PUBLISHERS = [
    "Pearson", "McGraw-Hill", "O'Reilly Media", "Wiley", "Prentice Hall",
    "MIT Press", "Packt Publishing", "Cambridge University Press", "Apress",
]

# (title, authors, category, subject, year, publisher, keywords, description, copies)
BOOKS = [
    (
        "Introduction to Algorithms", ["Thomas H. Cormen", "Charles E. Leiserson"],
        "Computer Science", "Algorithms", 2009, "MIT Press",
        "algorithms data structures complexity sorting graphs dynamic programming",
        "A comprehensive introduction to the modern study of computer algorithms, "
        "covering a broad range of algorithms in depth with rigorous analysis.", 3,
    ),
    (
        "Clean Code", ["Robert C. Martin"], "Software Engineering",
        "Programming Practices", 2008, "Prentice Hall",
        "clean code refactoring craftsmanship naming functions software quality",
        "A handbook of agile software craftsmanship with practical advice on "
        "writing readable, maintainable code.", 4,
    ),
    (
        "The Pragmatic Programmer", ["Andrew Hunt", "David Thomas"],
        "Software Engineering", "Programming Practices", 2019, "Pearson",
        "pragmatic programming career craftsmanship debugging automation",
        "Classic advice on the craft of software development, from personal "
        "responsibility to architectural techniques.", 2,
    ),
    (
        "Database System Concepts", ["Abraham Silberschatz", "Henry F. Korth"],
        "Databases", "Database Management Systems", 2019, "McGraw-Hill",
        "dbms sql relational model normalization transactions indexing recovery",
        "A standard textbook on database management systems covering relational "
        "design, SQL, transactions, and storage.", 3,
    ),
    (
        "SQL in 10 Minutes a Day", ["Ben Forta"], "Databases",
        "SQL", 2019, "Pearson",
        "sql queries joins beginner select insert update database tutorial",
        "A beginner-friendly, lesson-based introduction to writing SQL queries.", 2,
    ),
    (
        "Computer Networking: A Top-Down Approach", ["James F. Kurose", "Keith W. Ross"],
        "Computer Networks", "Networking", 2021, "Pearson",
        "networking tcp ip http dns routing wireless security layers protocols",
        "Explains computer networking from the application layer down, with a "
        "focus on the Internet and its protocols.", 3,
    ),
    (
        "Computer Security: Principles and Practice",
        ["William Stallings", "Lawrie Brown"], "Cybersecurity",
        "Information Security", 2017, "Pearson",
        "security cryptography authentication malware network attacks firewalls",
        "Covers the principles and practice of computer and network security, "
        "including cryptography, authentication, and defence against attacks.", 2,
    ),
    (
        "The Web Application Hacker's Handbook", ["Dafydd Stuttard", "Marcus Pinto"],
        "Cybersecurity", "Web Security", 2011, "Wiley",
        "web security sql injection xss csrf penetration testing owasp attacks",
        "A practical guide to finding and exploiting security flaws in web "
        "applications, and to defending against them.", 2,
    ),
    (
        "Hands-On Machine Learning with Scikit-Learn and TensorFlow",
        ["Aurelien Geron"], "Artificial Intelligence", "Machine Learning", 2019,
        "O'Reilly Media",
        "machine learning scikit-learn tensorflow neural networks beginner practical",
        "A practical, example-driven introduction to machine learning and deep "
        "learning using Python libraries.", 4,
    ),
    (
        "Deep Learning", ["Ian Goodfellow", "Yoshua Bengio", "Aaron Courville"],
        "Artificial Intelligence", "Deep Learning", 2016, "MIT Press",
        "deep learning neural networks optimization cnn rnn representation",
        "A thorough theoretical treatment of deep learning, from linear algebra "
        "foundations to modern research topics.", 2,
    ),
    (
        "Artificial Intelligence: A Modern Approach",
        ["Stuart Russell", "Peter Norvig"], "Artificial Intelligence",
        "Artificial Intelligence", 2020, "Pearson",
        "artificial intelligence search agents logic planning learning nlp",
        "The standard textbook on artificial intelligence, covering search, "
        "knowledge representation, planning, and learning.", 3,
    ),
    (
        "Python Crash Course", ["Eric Matthes"], "Programming Languages",
        "Python", 2019, "Wiley",
        "python beginner projects programming basics data visualization games",
        "A fast-paced, project-based introduction to Python programming for "
        "complete beginners.", 5,
    ),
    (
        "Fluent Python", ["Luciano Ramalho"], "Programming Languages",
        "Python", 2022, "O'Reilly Media",
        "python advanced idiomatic data model generators concurrency typing",
        "A deep dive into writing idiomatic, effective Python by understanding "
        "the language's data model.", 2,
    ),
    (
        "Effective Java", ["Joshua Bloch"], "Programming Languages",
        "Java", 2018, "Pearson",
        "java best practices generics enums lambdas concurrency design",
        "Seventy-eight best practices for writing robust, efficient Java, updated "
        "for modern language features.", 3,
    ),
    (
        "Head First Java", ["Kathy Sierra", "Bert Bates"], "Programming Languages",
        "Java", 2022, "O'Reilly Media",
        "java beginner oop classes objects inheritance gui threads",
        "A visually rich, beginner-oriented introduction to object-oriented "
        "programming with Java.", 3,
    ),
    (
        "Operating System Concepts", ["Abraham Silberschatz", "Peter B. Galvin"],
        "Computer Science", "Operating Systems", 2018, "Wiley",
        "operating systems processes threads scheduling memory paging file systems",
        "A widely used textbook on operating system principles: processes, "
        "memory management, storage, and protection.", 3,
    ),
    (
        "Cloud Computing: Concepts, Technology and Architecture",
        ["Thomas Erl"], "Cloud Computing", "Cloud Computing", 2013, "Prentice Hall",
        "cloud computing iaas paas saas virtualization aws azure architecture",
        "A structured overview of cloud computing models, mechanisms, and "
        "architectural patterns.", 2,
    ),
    (
        "Designing Data-Intensive Applications", ["Martin Kleppmann"],
        "Databases", "Distributed Systems", 2017, "O'Reilly Media",
        "distributed systems replication partitioning consistency storage streaming",
        "How to reason about the architecture of systems that store and process "
        "large volumes of data reliably and at scale.", 2,
    ),
    (
        "Introduction to the Theory of Computation", ["Michael Sipser"],
        "Computer Science", "Theory of Computation", 2012, "Cambridge University Press",
        "automata turing machines complexity np-completeness formal languages",
        "A rigorous but readable introduction to automata theory, computability, "
        "and computational complexity.", 2,
    ),
    (
        "Financial Accounting", ["Robert Libby", "Patricia Libby"], "Commerce",
        "Accounting", 2020, "McGraw-Hill",
        "accounting balance sheet income statement ledgers gaap financial reporting",
        "An introduction to financial accounting concepts and the preparation "
        "and use of financial statements.", 3,
    ),
    (
        "Principles of Marketing", ["Philip Kotler", "Gary Armstrong"],
        "Management Studies", "Marketing", 2021, "Pearson",
        "marketing branding consumer behaviour segmentation pricing promotion",
        "A comprehensive introduction to marketing strategy and the marketing "
        "mix, with contemporary case examples.", 3,
    ),
    (
        "The Lean Startup", ["Eric Ries"], "Management Studies",
        "Entrepreneurship", 2011, "Wiley",
        "startup lean mvp validated learning innovation pivot entrepreneurship",
        "A methodology for building companies and products through validated "
        "learning and rapid experimentation.", 2,
    ),
    (
        "Grokking Algorithms", ["Aditya Bhargava"], "Computer Science",
        "Algorithms", 2016, "Packt Publishing",
        "algorithms beginner illustrated binary search sorting graphs greedy",
        "An illustrated, beginner-friendly guide to common algorithms and when "
        "to use them.", 3,
    ),
    (
        "Learning React", ["Alex Banks", "Eve Porcello"], "Web Development",
        "Frontend Development", 2020, "O'Reilly Media",
        "react javascript components hooks state jsx frontend spa",
        "A modern, hooks-first introduction to building user interfaces with "
        "React.", 3,
    ),
    (
        "You Don't Know JS Yet", ["Kyle Simpson"], "Web Development",
        "JavaScript", 2020, "Apress",
        "javascript scope closures types coercion this prototypes es6",
        "A deep look at the core mechanisms of JavaScript that developers often "
        "skip over.", 2,
    ),
]

KNOWLEDGE_DOCS = [
    (
        "Borrowing and Renewal Policy", "policy", "public",
        """Students may borrow up to 4 books at a time for 14 days. Faculty may
borrow up to 10 books for 30 days.

Each loan can be renewed up to 2 times, adding 7 days per renewal, provided the
book has not been reserved by another member. Renewals can be done from the
member dashboard ("My Loans") or at the circulation desk.

A member with outstanding fines above the block threshold cannot borrow further
books until the fines are cleared at the circulation desk.

Books are issued and returned only at the circulation desk during library
hours. The AI assistant cannot issue, renew or return books on your behalf.""",
    ),
    (
        "Fine Policy", "policy", "public",
        """Overdue books are fined at 2 currency units per day per book after the
due date. There is no grace period unless announced.

Lost books: the member pays a flat replacement fine of 500 units plus any
processing charge set by the library.

Damaged books: a damage fine of up to 100 units is assessed by library staff
depending on the extent of the damage.

Fines are paid at the circulation desk. Library staff may waive or adjust a
fine in genuine cases; members cannot waive their own fines.""",
    ),
    (
        "Library Hours and Contact", "information", "public",
        """The library is open Monday to Saturday, 9:00 AM to 8:00 PM, and is
closed on public holidays and during declared institute breaks.

The circulation desk closes 15 minutes before the library closes.

For queries, email library@kle.edu or visit the circulation desk. The
administrator can update these hours and contact details in system settings.""",
    ),
    (
        "Using AI Search and the Assistant", "guide", "public",
        """AI Smart Search understands natural-language questions such as
"beginner books on machine learning" or "cybersecurity books about web
attacks". It combines keyword matching with semantic similarity and shows why
each result matched.

The AI Library Assistant answers questions about the catalogue, your loans,
your fines, and library policies. It only uses the library's own data and will
say when it cannot verify something. It never shares another member's
information and cannot carry out transactions.

If AI services are unavailable, normal keyword search and all library
operations continue to work.""",
    ),
    (
        "Reservations", "policy", "public",
        """If all copies of a book are on loan, a member can place a reservation
and join the queue for that title. When a copy becomes available it is held for
the next member in the queue for 48 hours, after which the reservation expires
and passes to the next member.

Reservation features are being rolled out; check the catalogue page of a book
for its current reservation status.""",
    ),
    (
        "Staff: Acquisitions and Weeding Notes", "internal", "staff",
        """Internal guidance for library staff. Procurement suggestions generated
by the system are advisory only and must be reviewed and approved by a
librarian before any purchase order is raised.

When weeding (archiving) a title, ensure no copies are on active loan; the
system blocks archiving in that case.""",
    ),
]
