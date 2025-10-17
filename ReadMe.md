# 📚 Conference Management System

## 📝 Overview
This project is a **Conference Management System** designed to handle the core processes of academic conferences — from paper submission to final decision.  
The backend is built using **RESTful web services** that interact with a **MongoDB** database to efficiently manage users, conferences, and papers.

It was developed as part of a **Software Technology** laboratory course at the **University of the Aegean**.

---

## 🚀 Features

### Conference Management
- Create, update, and manage conferences.
- Assign roles such as **PC Chair** and **PC Member**.
- Conference state transitions:  
  `CREATED → SUBMISSION → ASSIGNMENT → REVIEW → DECISION → FINAL_SUBMISSION → FINAL`.

### Paper Management
- Paper submission with unique ID, title, abstract, and authors.
- Update, assign reviewers, and manage revisions.
- Support for searching papers by title, abstract, or author.
- Paper state transitions:  
  `CREATED → SUBMITTED → REVIEWED → REJECTED/APPROVED → ACCEPTED`.

### User Roles & Access Control
- **Visitor** – View public information only.  
- **Author** – Create, edit, and submit papers.  
- **PC Member** – Review assigned papers.  
- **PC Chair** – Full conference and paper management control.

---

## 🏗️ System Architecture

- **Backend:** Node.js + Express  
- **Database:** MongoDB (local)  
- **Testing:** Jest, Postman  
- **Version Control:** GitHub

### Components
- `User Manager` – Authentication and user handling  
- `Conference Manager` – Conference creation and management  
- `Paper Manager` – Paper lifecycle handling  
- `DB Service` – Communication with MongoDB  

---
