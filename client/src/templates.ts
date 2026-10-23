import { CodeTemplate, Language } from './types';

export const CODE_TEMPLATES: Record<Language, CodeTemplate[]> = {
  python: [
    {
      name: 'Recursive Factorial',
      description: 'Step-by-step activation stack frames and base case unwinding',
      language: 'python',
      code: `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

result = factorial(4)
print("Factorial of 4 is:", result)
`
    },
    {
      name: 'List References & Mutation',
      description: 'Heap memory allocation, aliasing, and list mutation',
      language: 'python',
      code: `a = [10, 20, 30]
b = a
b.append(40)
c = [100, 200]

print("a:", a)
print("b:", b)
`
    },
    {
      name: 'Linked List Objects',
      description: 'Object references and pointer graph on the heap',
      language: 'python',
      code: `class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

head = Node(1)
head.next = Node(2)
head.next.next = Node(3)

curr = head
while curr:
    print("Node value:", curr.val)
    curr = curr.next
`
    },
    {
      name: 'Fibonacci Sequence',
      description: 'Recursive branching tree and stack frames',
      language: 'python',
      code: `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

ans = fib(4)
print("fib(4) =", ans)
`
    },
    {
      name: 'For Loop & Accumulator',
      description: 'Step-by-step iteration counter, condition evaluation, and accumulator state changes',
      language: 'python',
      code: `numbers = [10, 20, 30, 40]
total = 0

for num in numbers:
    total += num
    print("Added", num, "new total:", total)

print("Final Sum:", total)
`
    },
    {
      name: 'Math & Library Structures',
      description: 'Using math, collections, and standard library data structures with visual heap tracking',
      language: 'python',
      code: `import math
from collections import Counter

data = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3]
counts = dict(Counter(data))
hypot = math.sqrt(3**2 + 4**2)

print("Hypotenuse:", hypot)
print("Frequencies:", counts)
`
    }
  ],

  c: [
    {
      name: 'Pointer Swap with Addresses',
      description: 'Pass-by-pointer, memory addresses (0x7ffd...), and dereferencing',
      language: 'c',
      code: `#include <stdio.h>

void swap(int* a, int* b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}

int main() {
    int x = 10;
    int y = 20;
    
    printf("Before swap: x=%d, y=%d\\n", x, y);
    swap(&x, &y);
    printf("After swap: x=%d, y=%d\\n", x, y);
    
    return 0;
}
`
    },
    {
      name: 'Pointer Arithmetic & Arrays',
      description: 'Contiguous memory cells and pointer incrementing',
      language: 'c',
      code: `#include <stdio.h>

int main() {
    int arr[] = {10, 20, 30, 40};
    int* ptr = arr;
    
    for (int i = 0; i < 4; i++) {
        printf("Value: %d at address\\n", *ptr);
        ptr++;
    }
    
    return 0;
}
`
    },
    {
      name: 'Dynamic Memory (malloc & free)',
      description: 'Heap buffer allocation, heap addresses, and deallocation',
      language: 'c',
      code: `#include <stdio.h>
#include <stdlib.h>

int main() {
    int* ptr = (int*)malloc(sizeof(int));
    *ptr = 999;
    
    printf("Heap value: %d\\n", *ptr);
    free(ptr);
    
    return 0;
}
`
    },
    {
      name: 'Linked List with Pointers',
      description: 'Chained struct nodes with pointer arrows in memory',
      language: 'c',
      code: `#include <stdio.h>
#include <stdlib.h>

struct Node {
    int val;
    struct Node* next;
};

int main() {
    struct Node* n1 = (struct Node*)malloc(sizeof(struct Node));
    struct Node* n2 = (struct Node*)malloc(sizeof(struct Node));
    
    n1->val = 100;
    n1->next = n2;
    n2->val = 200;
    n2->next = NULL;
    
    printf("Head val: %d, Next val: %d\\n", n1->val, n1->next->val);
    return 0;
}
`
    }
  ],

  cpp: [
    {
      name: 'Classes & Heap Allocation',
      description: 'Object instantiation with new, field access, and heap references',
      language: 'cpp',
      code: `#include <iostream>

class Node {
public:
    int val;
    Node* next;
    Node(int v) {
        val = v;
        next = nullptr;
    }
};

int main() {
    Node* a = new Node(10);
    Node* b = new Node(20);
    a->next = b;
    
    std::cout << "Node a: " << a->val << std::endl;
    std::cout << "Node b: " << a->next->val << std::endl;
    
    delete a;
    delete b;
    return 0;
}
`
    },
    {
      name: 'References vs Pointers',
      description: 'C++ alias references (&) compared to pointer variables (*)',
      language: 'cpp',
      code: `#include <iostream>

int main() {
    int original = 50;
    int& ref = original;
    int* ptr = &original;
    
    ref = 75;
    *ptr = 100;
    
    std::cout << "Final original value: " << original << std::endl;
    return 0;
}
`
    }
  ],

  java: [
    {
      name: 'Object References & Heap Graph',
      description: 'Java reference types, heap allocations, and garbage collection concepts',
      language: 'java',
      code: `public class Main {
    static class Node {
        int val;
        Node next;
        Node(int v) {
            this.val = v;
            this.next = null;
        }
    }

    public static void main(String[] args) {
        Node first = new Node(10);
        Node second = new Node(20);
        first.next = second;

        System.out.println("First node: " + first.val);
        System.out.println("Second node: " + first.next.val);
    }
}
`
    },
    {
      name: 'Recursive Factorial',
      description: 'JVM activation records and call stack frames',
      language: 'java',
      code: `public class Main {
    public static int factorial(int n) {
        if (n <= 1) {
            return 1;
        }
        return n * factorial(n - 1);
    }

    public static void main(String[] args) {
        int res = factorial(3);
        System.out.println("Result: " + res);
    }
}
`
    }
  ],

  javascript: [
    {
      name: 'Closures & Scope Chain',
      description: 'Function closures maintaining variables across calls',
      language: 'javascript',
      code: `function createCounter() {
    let count = 0;
    return function() {
        count = count + 1;
        return count;
    };
}

const counter = createCounter();
let val1 = counter();
let val2 = counter();
console.log("val1:", val1);
console.log("val2:", val2);
`
    },
    {
      name: 'Objects & Array References',
      description: 'Object references on the heap and array mutations',
      language: 'javascript',
      code: `let user = {
    name: "Alice",
    skills: ["JS", "Python"]
};

let profile = user;
profile.name = "Alice Cyber";
let skillsCount = user.skills.length;

console.log("User updated:", user.name);
`
    }
  ]
};
