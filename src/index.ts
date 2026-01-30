import '@logseq/libs'

// ============================================================================
// TYPES
// ============================================================================

interface Person {
  uuid: string
  name: string
  birthday: Date | null
  lastContact: Date | null
  contactFrequency: number | null
  relationship: string | null
  email: string | null
}

interface BirthdayReminder {
  person: Person
  daysUntil: number
  age: number | null
}

interface ContactReminder {
  person: Person
  daysSinceContact: number
  daysOverdue: number
}

interface NewPersonData {
  name: string
  birthday: string | null
  relationship: string | null
  contactFrequency: number | null
  email: string | null
}

// Current view state
let currentView: 'list' | 'add' = 'list'

// ============================================================================
// LOGSEQ DB CONSTANTS
// ============================================================================

// Tag UUIDs from the Logseq DB schema
const PEOPLE_TAG_UUID = '00000002-3698-7117-0000-000000000000'
const TASK_TAG_UUID = '00000002-1282-1814-5700-000000000000'

// Property idents for the #people tag (with their suffixes)
const PEOPLE_PROPERTIES = {
  birthday: 'birthday-GB6GsLcK',
  lastContact: 'last-contact-zKo0vxkv',
  contactFrequency: 'contact-frequency-rE_86ouV',
  relationship: 'relationship-F2JPblxy',
  email: 'email-EYPFhTdc',
  phone: 'phone-jPxSkIoq',
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

function parseDate(value: any): Date | null {
  if (!value) return null
  
  // Handle Logseq date format (could be number, string, or object)
  if (typeof value === 'number') {
    return new Date(value)
  }
  
  if (typeof value === 'string') {
    // Try parsing various formats
    const date = new Date(value)
    if (!isNaN(date.getTime())) return date
    
    // Try YYYY-MM-DD format
    const match = value.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
    }
  }
  
  if (value instanceof Date) return value
  
  // Handle object with id reference (Logseq DB format)
  if (typeof value === 'object' && value !== null) {
    // It might be a date reference, try to extract
    if (value.journal) return parseDate(value.journal)
    if (value.date) return parseDate(value.date)
  }
  
  return null
}

function getDaysUntilBirthday(birthday: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate())
  
  if (thisYearBirthday < today) {
    // Birthday already passed this year, get next year's
    thisYearBirthday.setFullYear(today.getFullYear() + 1)
  }
  
  const diffTime = thisYearBirthday.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function getDaysSince(date: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)
  
  const diffTime = today.getTime() - targetDate.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

function calculateAge(birthday: Date): number {
  const today = new Date()
  let age = today.getFullYear() - birthday.getFullYear()
  const monthDiff = today.getMonth() - birthday.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
    age--
  }
  
  return age
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Get the next birthday occurrence from a birth date
 * If birthday already passed this year, returns next year's date
 */
function getNextBirthdayDate(birthday: Date): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const nextBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate())
  
  // If birthday already passed this year, use next year
  if (nextBirthday <= today) {
    nextBirthday.setFullYear(today.getFullYear() + 1)
  }
  
  return nextBirthday
}

/**
 * Format date as YYYY-MM-DD for Logseq
 */
function formatDateForLogseq(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a birthday string in various formats
 * Supports: "15 Apr 1988", "April 15, 1988", "1988-04-15", "15/04/1988", "04-15-1988", etc.
 */
function parseBirthdayInput(input: string): Date | null {
  if (!input || input.trim() === '') return null
  
  const trimmed = input.trim()
  
  // Month name mapping
  const months: Record<string, number> = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'sept': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11,
  }
  
  // Try ISO format: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }
  
  // Try: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const euroMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (euroMatch) {
    const [, day, month, year] = euroMatch
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }
  
  // Try: MM/DD/YYYY (US format) - only if month <= 12 and day > 12
  const usMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (usMatch) {
    const [, first, second, year] = usMatch
    const firstNum = parseInt(first)
    const secondNum = parseInt(second)
    // If first number is > 12, it must be day (European)
    // If second number is > 12, first must be month (US)
    // Default to European (DD/MM/YYYY) if ambiguous
    if (firstNum > 12) {
      return new Date(parseInt(year), secondNum - 1, firstNum)
    } else if (secondNum > 12) {
      return new Date(parseInt(year), firstNum - 1, secondNum)
    } else {
      // Ambiguous, default to DD/MM/YYYY (European)
      return new Date(parseInt(year), secondNum - 1, firstNum)
    }
  }
  
  // Try: "15 Apr 1988" or "15 April 1988"
  const dayMonthYearMatch = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/)
  if (dayMonthYearMatch) {
    const [, day, monthStr, year] = dayMonthYearMatch
    const month = months[monthStr.toLowerCase()]
    if (month !== undefined) {
      return new Date(parseInt(year), month, parseInt(day))
    }
  }
  
  // Try: "Apr 15 1988" or "April 15, 1988"
  const monthDayYearMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (monthDayYearMatch) {
    const [, monthStr, day, year] = monthDayYearMatch
    const month = months[monthStr.toLowerCase()]
    if (month !== undefined) {
      return new Date(parseInt(year), month, parseInt(day))
    }
  }
  
  // Try: "1988 Apr 15" or "1988 April 15"
  const yearMonthDayMatch = trimmed.match(/^(\d{4})\s+([a-zA-Z]+)\s+(\d{1,2})$/)
  if (yearMonthDayMatch) {
    const [, year, monthStr, day] = yearMonthDayMatch
    const month = months[monthStr.toLowerCase()]
    if (month !== undefined) {
      return new Date(parseInt(year), month, parseInt(day))
    }
  }
  
  // Try native Date parsing as fallback
  const nativeDate = new Date(trimmed)
  if (!isNaN(nativeDate.getTime())) {
    return nativeDate
  }
  
  return null
}

/**
 * Format a parsed date for display preview
 */
function formatBirthdayPreview(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short',
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  }
  return date.toLocaleDateString('en-US', options)
}

// ============================================================================
// PROPERTY HELPERS
// ============================================================================

/**
 * Find a property value by base name, handling Logseq DB's namespaced and suffixed property names
 * e.g., "birthday" matches:
 *   - ":user.property/birthday-GB6GsLcK" (user-created)
 *   - ":plugin.property.{plugin-id}/birthday-GB6GsLcK" (plugin-created)
 *   - "birthday-GB6GsLcK" (simple suffixed)
 */
function findProperty(obj: Record<string, any>, baseName: string): any {
  if (!obj) return undefined
  
  // Direct match first
  if (obj[baseName] !== undefined) return obj[baseName]
  
  // Look for :user.property/baseName-XXXXX format (Logseq DB user format)
  const userPropPattern = new RegExp(`^:user\\.property/${baseName}(-[A-Za-z0-9_-]+)?$`)
  for (const key of Object.keys(obj)) {
    if (userPropPattern.test(key)) {
      return obj[key]
    }
  }
  
  // Look for :plugin.property.{plugin-id}/baseName-XXXXX format (plugin-created)
  const pluginPropPattern = new RegExp(`^:plugin\\.property\\.[^/]+/${baseName}(-[A-Za-z0-9_-]+)?$`)
  for (const key of Object.keys(obj)) {
    if (pluginPropPattern.test(key)) {
      return obj[key]
    }
  }
  
  // Look for suffixed version (property-XXXXX format)
  const pattern = new RegExp(`^${baseName}-[A-Za-z0-9_-]+$`)
  for (const key of Object.keys(obj)) {
    if (pattern.test(key)) {
      return obj[key]
    }
  }
  
  return undefined
}

/**
 * Parse Logseq journal day format (YYYYMMDD number) to Date
 */
function parseJournalDay(journalDay: number): Date {
  const str = String(journalDay)
  const year = parseInt(str.substring(0, 4))
  const month = parseInt(str.substring(4, 6)) - 1 // 0-indexed
  const day = parseInt(str.substring(6, 8))
  return new Date(year, month, day)
}

// ============================================================================
// LOGSEQ QUERIES
// ============================================================================

async function getAllPeople(): Promise<Person[]> {
  const people: Person[] = []
  
  try {
    // Query for all pages with #people tag
    // Use the tag's title to find it, since that's how Logseq DB stores it
    const query = `
      [:find (pull ?p [*])
       :where
       [?t :block/title "people"]
       [?p :block/tags ?t]]
    `
    
    const results = await logseq.DB.datascriptQuery(query)
    
    if (!results || !Array.isArray(results)) {
      console.log('People Manager: No people found or invalid result')
      return []
    }
    
    console.log('People Manager: Found', results.length, 'people')
    
    for (const [page] of results) {
      if (!page) continue
      
      console.log('People Manager: Processing', page.name, 'with keys:', Object.keys(page))
      
      // In Logseq DB, properties are directly on the page object with suffixed names
      const birthday = findProperty(page, 'birthday')
      const lastContact = findProperty(page, 'last-contact')
      const contactFreq = findProperty(page, 'contact-frequency')
      const relationship = findProperty(page, 'relationship')
      const email = findProperty(page, 'email')
      
      console.log('People Manager: Raw birthday value:', birthday, 'type:', typeof birthday)
      
      // For date properties in DB mode, we need to resolve the reference
      let birthdayDate: Date | null = null
      let lastContactDate: Date | null = null
      
      if (birthday) {
        // Birthday might be an object with id, need to query the actual date
        if (typeof birthday === 'object' && birthday.id) {
          console.log('People Manager: Birthday is a reference with id:', birthday.id)
          try {
            // In Logseq DB, date properties reference journal pages
            // Try to get the block/page by ID
            const dateEntity = await logseq.Editor.getBlock(birthday.id) as any
            console.log('People Manager: Resolved date entity:', dateEntity)
            
            if (dateEntity) {
              // Logseq DB stores dates as journalDay in YYYYMMDD format
              if (dateEntity.journalDay) {
                birthdayDate = parseJournalDay(dateEntity.journalDay)
              } else if (dateEntity['journal-day']) {
                birthdayDate = parseJournalDay(dateEntity['journal-day'])
              } else if (dateEntity[':block/journal-day']) {
                birthdayDate = parseJournalDay(dateEntity[':block/journal-day'])
              } else if (dateEntity.title) {
                // Try to parse from title (might be a date string like "2009-04-16")
                birthdayDate = parseDate(dateEntity.title)
              } else if (dateEntity.name) {
                birthdayDate = parseDate(dateEntity.name)
              }
              console.log('People Manager: Resolved birthday date:', birthdayDate)
            }
          } catch (err) {
            console.log('People Manager: Error resolving birthday reference:', err)
          }
        } else if (typeof birthday === 'string') {
          birthdayDate = parseDate(birthday)
        } else if (typeof birthday === 'number') {
          // Might be a journalDay directly
          birthdayDate = parseJournalDay(birthday)
        }
      }
      
      if (lastContact) {
        if (typeof lastContact === 'object' && lastContact.id) {
          const dateBlock = await logseq.Editor.getBlock(lastContact.id) as any
          if (dateBlock) {
            if (dateBlock.journalDay) {
              lastContactDate = parseJournalDay(dateBlock.journalDay)
            } else if (dateBlock['journal-day']) {
              lastContactDate = parseJournalDay(dateBlock['journal-day'])
            } else {
              lastContactDate = parseDate(dateBlock.name || dateBlock.title)
            }
          }
        } else {
          lastContactDate = parseDate(lastContact)
        }
      }
      
      // Contact frequency - extract number
      let contactFrequencyNum: number | null = null
      if (contactFreq) {
        if (typeof contactFreq === 'number') {
          contactFrequencyNum = contactFreq
        } else if (typeof contactFreq === 'object' && contactFreq.id) {
          // It's a reference, get the value block
          const block = await logseq.Editor.getBlock(contactFreq.id) as any
          if (block) {
            // Check for :logseq.property/value (number properties)
            const propValue = block[':logseq.property/value']
            if (propValue !== undefined) {
              contactFrequencyNum = typeof propValue === 'number' ? propValue : parseInt(String(propValue))
            } else {
              contactFrequencyNum = parseInt(block.title || block.content || '0')
            }
            console.log('People Manager: Resolved contact-frequency', block, '->', contactFrequencyNum)
          }
        } else {
          contactFrequencyNum = parseInt(String(contactFreq))
        }
      }
      
      // Relationship - extract string
      let relationshipStr: string | null = null
      if (relationship) {
        if (typeof relationship === 'string') {
          relationshipStr = relationship
        } else if (typeof relationship === 'object' && relationship.id) {
          const block = await logseq.Editor.getBlock(relationship.id) as any
          if (block) {
            relationshipStr = block.title || block.content || null
            console.log('People Manager: Resolved relationship', block, '->', relationshipStr)
          }
        }
      }
      
      const person: Person = {
        uuid: page.uuid,
        name: page['original-name'] || page.name || 'Unknown',
        birthday: birthdayDate,
        lastContact: lastContactDate,
        contactFrequency: contactFrequencyNum,
        relationship: relationshipStr,
        email: typeof email === 'string' ? email : null,
      }
      
      console.log('People Manager: Parsed person', person)
      people.push(person)
    }
    
  } catch (error) {
    console.error('People Manager: Error querying people:', error)
  }
  
  return people
}

// ============================================================================
// REMINDER LOGIC
// ============================================================================

function getUpcomingBirthdays(people: Person[], withinDays: number = 30): BirthdayReminder[] {
  const reminders: BirthdayReminder[] = []
  
  for (const person of people) {
    if (!person.birthday) continue
    
    const daysUntil = getDaysUntilBirthday(person.birthday)
    
    if (daysUntil <= withinDays) {
      reminders.push({
        person,
        daysUntil,
        age: daysUntil === 0 ? calculateAge(person.birthday) : calculateAge(person.birthday) + 1,
      })
    }
  }
  
  // Sort by days until birthday
  return reminders.sort((a, b) => a.daysUntil - b.daysUntil)
}

function getPeopleToContact(people: Person[]): ContactReminder[] {
  const reminders: ContactReminder[] = []
  
  for (const person of people) {
    if (!person.contactFrequency) continue
    
    const daysSince = person.lastContact ? getDaysSince(person.lastContact) : Infinity
    const daysOverdue = daysSince - person.contactFrequency
    
    if (daysOverdue >= 0 || !person.lastContact) {
      reminders.push({
        person,
        daysSinceContact: daysSince === Infinity ? -1 : daysSince,
        daysOverdue: person.lastContact ? daysOverdue : person.contactFrequency,
      })
    }
  }
  
  // Sort by most overdue first
  return reminders.sort((a, b) => b.daysOverdue - a.daysOverdue)
}

// ============================================================================
// TASK CREATION
// ============================================================================

async function createBirthdayTask(person: Person, daysUntil: number): Promise<boolean> {
  try {
    const todayPage = await logseq.Editor.getCurrentPage()
    
    if (!todayPage) {
      console.error('People Manager: No current page for birthday task')
      return false
    }
    
    const taskContent = daysUntil === 0 
      ? `TODO [[${person.name}]]'s Birthday is TODAY!`
      : `TODO [[${person.name}]]'s Birthday in ${daysUntil} days`
    
    await logseq.Editor.insertBlock(todayPage.uuid, taskContent, { sibling: false })
    
    return true
  } catch (error) {
    console.error('People Manager: Error creating birthday task:', error)
    return false
  }
}

async function createContactTask(person: Person, daysOverdue: number): Promise<boolean> {
  try {
    const todayPage = await logseq.Editor.getCurrentPage()
    
    if (!todayPage) {
      console.error('People Manager: No current page for contact task')
      return false
    }
    
    const taskContent = daysOverdue > 0
      ? `TODO Reach out to [[${person.name}]] (${daysOverdue} days overdue)`
      : `TODO Time to contact [[${person.name}]]`
    
    await logseq.Editor.insertBlock(todayPage.uuid, taskContent, { sibling: false })
    
    return true
  } catch (error) {
    console.error('People Manager: Error creating contact task:', error)
    return false
  }
}

// ============================================================================
// PERSON CREATION
// ============================================================================

async function createPerson(data: NewPersonData): Promise<{ success: boolean; error?: string }> {
  try {
    if (!data.name || data.name.trim() === '') {
      return { success: false, error: 'Name is required' }
    }

    const personName = data.name.trim()
    
    // Check if page already exists
    const existingPage = await logseq.Editor.getPage(personName)
    if (existingPage) {
      return { success: false, error: `A page named "${personName}" already exists` }
    }

    // Create the page
    const page = await logseq.Editor.createPage(personName, {}, { 
      createFirstBlock: false,
      redirect: false 
    })
    
    if (!page) {
      return { success: false, error: 'Failed to create page' }
    }

    console.log('People Manager: Created page', page)

    // Add #people tag using the tag's UUID
    await logseq.Editor.addBlockTag(page.uuid, PEOPLE_TAG_UUID)
    
    // Set properties using the tag's schema property idents (with suffixes)
    // This ensures values are stored in the correct typed properties
    if (data.birthday) {
      // For date properties, we pass the date string - Logseq will handle the reference
      await logseq.Editor.upsertBlockProperty(page.uuid, PEOPLE_PROPERTIES.birthday, data.birthday)
    }
    
    if (data.relationship) {
      await logseq.Editor.upsertBlockProperty(page.uuid, PEOPLE_PROPERTIES.relationship, data.relationship)
    }
    
    if (data.contactFrequency && data.contactFrequency > 0) {
      await logseq.Editor.upsertBlockProperty(page.uuid, PEOPLE_PROPERTIES.contactFrequency, data.contactFrequency)
    }
    
    if (data.email) {
      await logseq.Editor.upsertBlockProperty(page.uuid, PEOPLE_PROPERTIES.email, data.email)
    }

    // Create birthday reminder task if birthday is provided
    if (data.birthday) {
      const birthdayDate = new Date(data.birthday)
      if (!isNaN(birthdayDate.getTime())) {
        await createBirthdayReminderTask(personName, birthdayDate)
      }
    }

    console.log('People Manager: Person created successfully:', personName)
    return { success: true }
    
  } catch (error) {
    console.error('People Manager: Error creating person:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Create a birthday reminder task on the next occurrence of the birthday
 * The task is created as a proper #Task block on the journal page for that date
 */
async function createBirthdayReminderTask(personName: string, birthday: Date): Promise<boolean> {
  try {
    const nextBirthday = getNextBirthdayDate(birthday)
    const journalDateStr = formatDateForLogseq(nextBirthday)
    
    console.log(`People Manager: Creating birthday task for ${personName} on ${journalDateStr}`)
    
    // Get or create the journal page for that date
    let journalPage = await logseq.Editor.getPage(journalDateStr)
    
    if (!journalPage) {
      // Create the journal page
      journalPage = await logseq.Editor.createPage(journalDateStr, {}, {
        createFirstBlock: false,
        journal: true,
        redirect: false
      })
    }
    
    if (!journalPage) {
      console.error('People Manager: Could not get or create journal page')
      return false
    }
    
    // Create the task block content - just the text, we'll add the tag separately
    const taskContent = `[[${personName}]]'s Birthday!`
    
    // Append a new block to the journal page
    const newBlock = await logseq.Editor.appendBlockInPage(journalPage.uuid, taskContent)
    
    if (newBlock) {
      // Add the #Task tag to make it an actual task
      await logseq.Editor.addBlockTag(newBlock.uuid, TASK_TAG_UUID)
      console.log(`People Manager: Created birthday task block with #Task tag`)
    }
    
    console.log(`People Manager: Created birthday reminder for ${personName} on ${journalDateStr}`)
    return true
  } catch (error) {
    console.error('People Manager: Error creating birthday reminder:', error)
    return false
  }
}

// ============================================================================
// UI RENDERING
// ============================================================================

function renderAddPersonForm(successMessage?: string): string {
  return `
    ${successMessage ? `
      <div class="success-message">
        <span>✓</span> ${successMessage}
      </div>
    ` : ''}
    
    <div class="back-link" data-action="back">
      ← Back to list
    </div>
    
    <div class="section">
      <div class="section-title">Add New Person</div>
      
      <form id="add-person-form">
        <div class="form-group">
          <label for="person-name">Name *</label>
          <input type="text" id="person-name" placeholder="Enter person's name" required>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="person-birthday">Birthday</label>
            <input type="text" id="person-birthday" placeholder="e.g., 15 Apr 1988 or 1988-04-15">
            <div id="birthday-preview" class="input-preview"></div>
          </div>
          
          <div class="form-group">
            <label for="person-relationship">Relationship</label>
            <select id="person-relationship">
              <option value="">Select...</option>
              <option value="family">Family</option>
              <option value="friend">Friend</option>
              <option value="colleague">Colleague</option>
              <option value="mentor">Mentor</option>
              <option value="acquaintance">Acquaintance</option>
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="person-contact-freq">Contact Frequency (days)</label>
            <input type="number" id="person-contact-freq" placeholder="e.g., 14" min="1">
          </div>
          
          <div class="form-group">
            <label for="person-email">Email</label>
            <input type="email" id="person-email" placeholder="email@example.com">
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="save-and-add">
            Save & Add Another
          </button>
          <button type="submit" class="btn btn-primary">
            Save & Close
          </button>
        </div>
      </form>
    </div>
  `
}

function renderContent(
  birthdays: BirthdayReminder[],
  contacts: ContactReminder[]
): string {
  let html = ''
  
  // Birthdays section
  html += `
    <div class="section">
      <div class="section-title">
        Upcoming Birthdays
        ${birthdays.length > 0 ? `<span class="badge">${birthdays.length}</span>` : ''}
      </div>
  `
  
  if (birthdays.length === 0) {
    html += `<div class="empty-state">No upcoming birthdays in the next 30 days</div>`
  } else {
    for (const reminder of birthdays) {
      const daysText = reminder.daysUntil === 0 
        ? 'Today!' 
        : reminder.daysUntil === 1 
          ? 'Tomorrow' 
          : `${reminder.daysUntil} days`
      
      const badgeClass = reminder.daysUntil <= 7 ? 'soon' : 'ok'
      
      html += `
        <div class="person-card" data-uuid="${reminder.person.uuid}" data-action="open">
          <div class="person-info">
            <div class="person-name">${reminder.person.name}</div>
            <div class="person-detail">
              ${reminder.person.birthday ? formatDate(reminder.person.birthday) : ''} 
              ${reminder.age ? `(turning ${reminder.age})` : ''}
            </div>
          </div>
          <div class="person-action">
            <span class="days-badge ${badgeClass}">${daysText}</span>
          </div>
        </div>
      `
    }
  }
  html += `</div>`
  
  // Contacts section
  html += `
    <div class="section">
      <div class="section-title">
        People to Contact
        ${contacts.length > 0 ? `<span class="badge warning">${contacts.length}</span>` : ''}
      </div>
  `
  
  if (contacts.length === 0) {
    html += `<div class="empty-state">All caught up! No overdue contacts.</div>`
  } else {
    for (const reminder of contacts) {
      const badgeClass = reminder.daysOverdue > 14 ? 'overdue' : 'soon'
      const daysText = reminder.daysSinceContact < 0 
        ? 'Never contacted'
        : `${reminder.daysOverdue}d overdue`
      
      html += `
        <div class="person-card" data-uuid="${reminder.person.uuid}" data-action="open">
          <div class="person-info">
            <div class="person-name">${reminder.person.name}</div>
            <div class="person-detail">
              ${reminder.person.relationship || 'Contact'} 
              ${reminder.daysSinceContact >= 0 ? `- Last: ${reminder.daysSinceContact}d ago` : ''}
            </div>
          </div>
          <div class="person-action">
            <span class="days-badge ${badgeClass}">${daysText}</span>
          </div>
        </div>
      `
    }
  }
  html += `</div>`
  
  return html
}

async function refreshUI(successMessage?: string): Promise<void> {
  const content = document.getElementById('content')
  if (!content) return
  
  if (currentView === 'add') {
    content.innerHTML = renderAddPersonForm(successMessage)
    setupAddPersonFormHandlers()
    return
  }
  
  // List view
  content.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <div>Loading people...</div>
    </div>
  `
  
  try {
    const people = await getAllPeople()
    const birthdays = getUpcomingBirthdays(people, 30)
    const contacts = getPeopleToContact(people)
    
    content.innerHTML = renderContent(birthdays, contacts)
    
    // Add click handlers for person cards
    content.querySelectorAll('.person-card[data-uuid]').forEach(card => {
      card.addEventListener('click', async () => {
        const uuid = card.getAttribute('data-uuid')
        if (uuid) {
          await logseq.App.pushState('page', { name: uuid })
          hideMainUI()
        }
      })
    })
    
  } catch (error) {
    console.error('People Manager: Error refreshing UI:', error)
    content.innerHTML = `
      <div class="empty-state">
        Error loading people. Check console for details.
      </div>
    `
  }
}

function getFormData(): NewPersonData {
  const nameInput = document.getElementById('person-name') as HTMLInputElement
  const birthdayInput = document.getElementById('person-birthday') as HTMLInputElement
  const relationshipSelect = document.getElementById('person-relationship') as HTMLSelectElement
  const contactFreqInput = document.getElementById('person-contact-freq') as HTMLInputElement
  const emailInput = document.getElementById('person-email') as HTMLInputElement
  
  // Parse the birthday text input
  let birthdayStr: string | null = null
  if (birthdayInput?.value) {
    const parsedDate = parseBirthdayInput(birthdayInput.value)
    if (parsedDate) {
      birthdayStr = formatDateForLogseq(parsedDate)
    }
  }
  
  return {
    name: nameInput?.value || '',
    birthday: birthdayStr,
    relationship: relationshipSelect?.value || null,
    contactFrequency: contactFreqInput?.value ? parseInt(contactFreqInput.value) : null,
    email: emailInput?.value || null,
  }
}

function clearForm(): void {
  const form = document.getElementById('add-person-form') as HTMLFormElement
  if (form) {
    form.reset()
  }
}

function setupAddPersonFormHandlers(): void {
  const content = document.getElementById('content')
  if (!content) return
  
  // Back link handler
  const backLink = content.querySelector('[data-action="back"]')
  if (backLink) {
    backLink.addEventListener('click', () => {
      currentView = 'list'
      refreshUI()
    })
  }
  
  // Birthday input live preview
  const birthdayInput = document.getElementById('person-birthday') as HTMLInputElement
  const birthdayPreview = document.getElementById('birthday-preview')
  if (birthdayInput && birthdayPreview) {
    birthdayInput.addEventListener('input', () => {
      const value = birthdayInput.value.trim()
      if (!value) {
        birthdayPreview.textContent = ''
        birthdayPreview.className = 'input-preview'
        return
      }
      
      const parsed = parseBirthdayInput(value)
      if (parsed) {
        birthdayPreview.textContent = formatBirthdayPreview(parsed)
        birthdayPreview.className = 'input-preview valid'
      } else {
        birthdayPreview.textContent = 'Could not parse date'
        birthdayPreview.className = 'input-preview invalid'
      }
    })
  }
  
  // Form submission handler (Save & Close)
  const form = document.getElementById('add-person-form') as HTMLFormElement
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      await handleSavePerson(false)
    })
  }
  
  // Save & Add Another button
  const saveAndAddBtn = content.querySelector('[data-action="save-and-add"]')
  if (saveAndAddBtn) {
    saveAndAddBtn.addEventListener('click', async () => {
      await handleSavePerson(true)
    })
  }
}

async function handleSavePerson(addAnother: boolean): Promise<void> {
  const data = getFormData()
  
  if (!data.name || data.name.trim() === '') {
    await logseq.UI.showMsg('Please enter a name', 'warning')
    return
  }
  
  const result = await createPerson(data)
  
  if (result.success) {
    if (addAnother) {
      clearForm()
      await refreshUI(`Added "${data.name}" successfully!`)
      // Focus on the name input
      const nameInput = document.getElementById('person-name') as HTMLInputElement
      if (nameInput) nameInput.focus()
    } else {
      currentView = 'list'
      await logseq.UI.showMsg(`Added "${data.name}" successfully!`, 'success')
      await refreshUI()
    }
  } else {
    await logseq.UI.showMsg(result.error || 'Failed to create person', 'error')
  }
}

function showAddPersonView(): void {
  currentView = 'add'
  refreshUI()
}

async function checkAndCreateReminders(): Promise<void> {
  const people = await getAllPeople()
  const birthdays = getUpcomingBirthdays(people, 7) // Next 7 days
  const contacts = getPeopleToContact(people)
  
  let created = 0
  
  // Create birthday tasks for next 7 days
  for (const reminder of birthdays) {
    const success = await createBirthdayTask(reminder.person, reminder.daysUntil)
    if (success) created++
  }
  
  // Create contact tasks for overdue contacts
  for (const reminder of contacts) {
    if (reminder.daysOverdue >= 0) {
      const success = await createContactTask(reminder.person, reminder.daysOverdue)
      if (success) created++
    }
  }
  
  if (created > 0) {
    await logseq.UI.showMsg(`Created ${created} reminder task(s)`, 'success')
  } else {
    await logseq.UI.showMsg('No new reminders needed', 'info')
  }
  
  hideMainUI()
}

// ============================================================================
// UI HANDLING
// ============================================================================

function showMainUI() {
  currentView = 'list'  // Reset to list view when opening
  logseq.showMainUI({ autoFocus: true })
  refreshUI()
}

function hideMainUI() {
  logseq.hideMainUI({ restoreEditingCursor: true })
}

function toggleMainUI() {
  if (logseq.isMainUIVisible) {
    hideMainUI()
  } else {
    showMainUI()
  }
}

// ============================================================================
// BIRTHDAY TASK COMPLETION DETECTION
// ============================================================================

/**
 * Extract person name from birthday task content
 * Matches patterns like: "TODO [[Person Name]]'s Birthday" or "DONE [[Person Name]]'s Birthday"
 */
function extractBirthdayPersonName(content: string): string | null {
  // Match [[Name]]'s Birthday pattern
  const match = content.match(/\[\[([^\]]+)\]\]['']s Birthday/)
  return match ? match[1] : null
}

/**
 * Check if a block content is a birthday task
 */
function isBirthdayTask(content: string): boolean {
  return content.includes("'s Birthday") && content.includes('[[')
}

/**
 * Handle when a birthday task is marked as DONE
 * Creates a new birthday reminder for next year
 */
async function handleBirthdayTaskCompleted(personName: string): Promise<void> {
  try {
    console.log(`People Manager: Birthday task completed for ${personName}, creating next year's reminder`)
    
    // Get the person's page to find their birthday
    const personPage = await logseq.Editor.getPage(personName) as any
    if (!personPage) {
      console.log(`People Manager: Could not find page for ${personName}`)
      return
    }
    
    // Find the birthday property using the correct ident
    const birthday = findProperty(personPage, 'birthday')
    if (!birthday) {
      console.log(`People Manager: No birthday found for ${personName}`)
      return
    }
    
    // Resolve the birthday date
    let birthdayDate: Date | null = null
    if (typeof birthday === 'object' && birthday.id) {
      const dateBlock = await logseq.Editor.getBlock(birthday.id) as any
      if (dateBlock) {
        if (dateBlock.journalDay) {
          birthdayDate = parseJournalDay(dateBlock.journalDay)
        } else if (dateBlock['journal-day']) {
          birthdayDate = parseJournalDay(dateBlock['journal-day'])
        } else {
          birthdayDate = parseDate(dateBlock.name || dateBlock.title)
        }
      }
    } else {
      birthdayDate = parseDate(birthday)
    }
    
    if (!birthdayDate) {
      console.log(`People Manager: Could not parse birthday date for ${personName}`)
      return
    }
    
    // Calculate next year's birthday (not just next occurrence, but specifically next year from now)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // The next birthday should be next year since they just completed this year's task
    const nextYearBirthday = new Date(today.getFullYear() + 1, birthdayDate.getMonth(), birthdayDate.getDate())
    
    const journalDateStr = formatDateForLogseq(nextYearBirthday)
    
    // Get or create the journal page for that date
    let journalPage = await logseq.Editor.getPage(journalDateStr)
    
    if (!journalPage) {
      journalPage = await logseq.Editor.createPage(journalDateStr, {}, {
        createFirstBlock: false,
        journal: true,
        redirect: false
      })
    }
    
    if (journalPage) {
      // Create the task block content
      const taskContent = `[[${personName}]]'s Birthday!`
      
      // Append a new block to the journal page
      const newBlock = await logseq.Editor.appendBlockInPage(journalPage.uuid, taskContent)
      
      if (newBlock) {
        // Add the #Task tag to make it an actual task
        await logseq.Editor.addBlockTag(newBlock.uuid, TASK_TAG_UUID)
      }
    }
    
    console.log(`People Manager: Created birthday reminder for ${personName} on ${journalDateStr}`)
    await logseq.UI.showMsg(`Created next year's birthday reminder for ${personName}`, 'success')
    
  } catch (error) {
    console.error('People Manager: Error handling birthday task completion:', error)
  }
}

/**
 * Set up listener for task completions
 * Watches for TODO -> DONE transitions on birthday tasks
 */
function setupTaskCompletionListener(): void {
  // Listen for block changes
  logseq.DB.onChanged(async ({ blocks, txData, txMeta }) => {
    if (!blocks || blocks.length === 0) return
    
    for (const block of blocks) {
      const content = block.content || ''
      
      // Check if this is a birthday task that was just marked as DONE
      if (isBirthdayTask(content) && content.startsWith('DONE')) {
        const personName = extractBirthdayPersonName(content)
        if (personName) {
          // Small delay to ensure the transaction is complete
          setTimeout(() => {
            handleBirthdayTaskCompleted(personName)
          }, 500)
        }
      }
    }
  })
  
  console.log('People Manager: Task completion listener set up')
}

// ============================================================================
// PLUGIN MAIN
// ============================================================================

async function main() {
  console.log('People Manager plugin loaded')
  
  // Provide model for UI actions
  logseq.provideModel({
    toggleUI: toggleMainUI,
    closeUI: hideMainUI,
    refresh: refreshUI,
    checkAll: checkAndCreateReminders,
    addPerson: showAddPersonView,
  })
  
  // Register toolbar button with inline SVG (more reliable than icon fonts)
  logseq.App.registerUIItem('toolbar', {
    key: 'people-manager-button',
    template: `
      <a class="button" data-on-click="toggleUI" title="People Manager" style="display: flex; align-items: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      </a>
    `
  })
  
  // Register slash commands
  logseq.Editor.registerSlashCommand('People Manager', async () => {
    showMainUI()
  })
  
  logseq.Editor.registerSlashCommand('Add Person', async () => {
    currentView = 'add'
    logseq.showMainUI({ autoFocus: true })
    refreshUI()
  })
  
  logseq.Editor.registerSlashCommand('Check Birthday Reminders', async () => {
    await checkAndCreateReminders()
  })
  
  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideMainUI()
  })
  
  // Close on X button click
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target?.closest('[data-close]')) {
      hideMainUI()
    }
  })
  
  // Set up action button handlers (these are in the static HTML, not dynamic Logseq UI)
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const button = target?.closest('button[data-on-click]') as HTMLElement
    if (button) {
      const action = button.getAttribute('data-on-click')
      switch (action) {
        case 'refresh':
          refreshUI()
          break
        case 'addPerson':
          showAddPersonView()
          break
        case 'checkAll':
          checkAndCreateReminders()
          break
      }
    }
  })
  
  // Set up listener for birthday task completions
  setupTaskCompletionListener()
  
  console.log('People Manager: Ready')
}

logseq.ready(main).catch(console.error)
